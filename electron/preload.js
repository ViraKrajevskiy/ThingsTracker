const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartToUpdate: () => ipcRenderer.invoke('restart-to-update'),
  onUpdateStatus: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
})
