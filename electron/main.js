const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch (e) { console.error('[updater] not available:', e.message) }
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const net = require('net')
const fs = require('fs')

let pyProc = null
let mainWindow = null
let backendPort = 8766
let pendingDeepLink = null

// --- custom protocol: thingtracker://open?u=<url-encoded full invite url> ---
const PROTOCOL = 'thingtracker'
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    try { app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]) } catch (e) {}
  }
} else {
  try { app.setAsDefaultProtocolClient(PROTOCOL) } catch (e) {}
}

function urlFromDeepLink(link) {
  try {
    const u = new URL(link)
    const target = u.searchParams.get('u')
    if (target) {
      const dec = decodeURIComponent(target)
      if (/^https?:\/\//i.test(dec)) return dec
    }
  } catch (e) {}
  return null
}

function handleDeepLink(link) {
  if (!link) return
  const target = urlFromDeepLink(link)
  if (!target) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadWithRetry(mainWindow, target)
    try { mainWindow.show(); mainWindow.focus() } catch (e) {}
  } else {
    pendingDeepLink = target
  }
}


const isDev = !app.isPackaged
const PREFERRED_PORT = 8766

// ── port helpers ────────────────────────────────────────────────
function isPortFree(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, host)
  })
}
function getEphemeralPort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port
      srv.close(() => resolve(p))
    })
  })
}
// Prefer 8766 (stable, easy to bookmark from a phone); if it's taken by
// another app, transparently fall back to a free OS-assigned port.
async function choosePort() {
  if (await isPortFree(PREFERRED_PORT)) return PREFERRED_PORT
  const p = await getEphemeralPort()
  console.log(`[port] ${PREFERRED_PORT} busy -> using ${p}`)
  return p
}

// ── backend ─────────────────────────────────────────────────────
function devPython() {
  const venvPy = process.platform === 'win32'
    ? path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python')
  if (fs.existsSync(venvPy)) return venvPy
  return process.platform === 'win32' ? 'python' : 'python3'
}
function backendCommand() {
  if (isDev) {
    const script = path.join(__dirname, '..', 'backend', 'main.py')
    return { cmd: devPython(), args: [script], cwd: path.join(__dirname, '..', 'backend') }
  }
  const exe = process.platform === 'win32' ? 'thingtracker-backend.exe' : 'thingtracker-backend'
  const bin = path.join(process.resourcesPath, 'backend', exe)
  return { cmd: bin, args: [], cwd: path.dirname(bin) }
}
function startBackend(port) {
  const { cmd, args, cwd } = backendCommand()
  if (!isDev && process.platform !== 'win32') {
    try { fs.chmodSync(cmd, 0o755) } catch (e) { console.error('[backend] chmod failed:', e.message) }
  }
  console.log('[backend] starting on port', port)
  pyProc = spawn(cmd, args, { cwd, env: { ...process.env, TT_PORT: String(port) } })
  pyProc.stdout.on('data', d => console.log('[backend]', d.toString().trim()))
  pyProc.stderr.on('data', d => console.error('[backend]', d.toString().trim()))
  pyProc.on('close', code => console.log('[backend] exited', code))
  pyProc.on('error', err => console.error('[backend] spawn error:', err.message))
}
function healthOk(port, cb) {
  const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => { res.resume(); cb(res.statusCode === 200) })
  req.on('error', () => cb(false))
  req.setTimeout(1000, () => { req.destroy(); cb(false) })
}
function waitForBackend(port, cb, tries = 0) {
  healthOk(port, (up) => {
    if (up) return cb(true)
    if (tries > 100) return cb(false)
    setTimeout(() => waitForBackend(port, cb, tries + 1), 300)
  })
}

// ── dev: locate the Vite server (it may drift off 5173 if busy) ──
function findViteServer(cb, ports = [5173, 5174, 5175, 5176, 5177], tries = 0) {
  let i = 0
  const tryNext = () => {
    if (i >= ports.length) {
      if (tries > 60) return cb(null)
      return setTimeout(() => findViteServer(cb, ports, tries + 1), 500)
    }
    const port = ports[i++]
    const req = http.get(`http://localhost:${port}/`, (res) => { res.resume(); cb(port) })
    req.on('error', () => tryNext())
    req.setTimeout(800, () => { req.destroy(); tryNext() })
  }
  tryNext()
}

function loadWithRetry(win, url, tries = 0) {
  if (!win || win.isDestroyed()) return
  win.loadURL(url).catch(() => {
    if (tries > 60) return
    setTimeout(() => { if (win && !win.isDestroyed()) loadWithRetry(win, url, tries + 1) }, 500)
  })
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    backgroundColor: '#0A1628',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  })
  loadWithRetry(mainWindow, url)
}

function sendStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', Object.assign({ status }, extra || {}))
  }
}

// Manual check button (from the UI)
ipcMain.handle('check-for-updates', async () => {
  if (isDev || !autoUpdater) { sendStatus('dev'); return { status: 'dev' } }
  try { await autoUpdater.checkForUpdates(); return { status: 'checking' } }
  catch (e) { sendStatus('error', { message: e.message }); return { status: 'error' } }
})
ipcMain.handle('restart-to-update', () => { if (autoUpdater) autoUpdater.quitAndInstall() })

function setupAutoUpdate() {
  if (isDev || !autoUpdater) return
  autoUpdater.autoDownload = true
  autoUpdater.on('checking-for-update', () => sendStatus('checking'))
  autoUpdater.on('update-available', (info) => sendStatus('available', { version: info && info.version }))
  autoUpdater.on('update-not-available', () => sendStatus('none'))
  autoUpdater.on('download-progress', (p) => sendStatus('downloading', { percent: Math.round(p.percent || 0) }))
  autoUpdater.on('update-downloaded', (info) => {
    sendStatus('downloaded', { version: info && info.version })
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      title: 'Обновление ThingTracker',
      message: 'Доступна новая версия' + (info && info.version ? ' ' + info.version : ''),
      detail: 'Обновление загружено. Перезапустить приложение, чтобы установить?',
    }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall() })
  })
  autoUpdater.on('error', (e) => { console.error('[updater]', e == null ? 'unknown' : (e.message || e)); sendStatus('error', { message: e && e.message }) })
  // check on startup + every hour
  try { autoUpdater.checkForUpdates() } catch (e) { console.error('[updater]', e.message) }
  setInterval(() => { try { autoUpdater.checkForUpdates() } catch (e) {} }, 60 * 60 * 1000)
}

// single instance — route protocol links into the running app
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    const link = argv.find(a => a.startsWith(PROTOCOL + '://'))
    if (link) handleDeepLink(link)
    else if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
  })
}
// macOS
app.on('open-url', (event, link) => { event.preventDefault(); handleDeepLink(link) })
// windows/linux cold start
{
  const coldLink = process.argv.find(a => a.startsWith(PROTOCOL + '://'))
  if (coldLink) pendingDeepLink = urlFromDeepLink(coldLink)
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  backendPort = await choosePort()
  startBackend(backendPort)
  waitForBackend(backendPort, (ok) => {
    if (!ok) console.warn('[backend] not reachable; UI may fail data calls.')
    if (isDev) {
      // UI is served by Vite; tell it which backend port to talk to.
      findViteServer((vitePort) => {
        const p = vitePort || 5173
        createWindow(`http://localhost:${p}/?ttport=${backendPort}`)
      })
    } else {
      // UI is served by the backend itself -> same-origin, no port needed.
      createWindow(`http://127.0.0.1:${backendPort}/`)
    }
    if (pendingDeepLink && mainWindow && !mainWindow.isDestroyed()) {
      loadWithRetry(mainWindow, pendingDeepLink); pendingDeepLink = null
    }
    setupAutoUpdate()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const url = isDev ? `http://localhost:5173/?ttport=${backendPort}` : `http://127.0.0.1:${backendPort}/`
      createWindow(url)
    }
  })
})

app.on('window-all-closed', () => {
  if (pyProc) pyProc.kill()
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => { if (pyProc) pyProc.kill() })
