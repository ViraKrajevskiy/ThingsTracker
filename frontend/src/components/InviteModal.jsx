import React, { useState, useEffect } from 'react'
import { IconLink } from './Icons.jsx'
import { api } from '../api.js'

const LS_TS = 'tt_tailscale_host'
const LS_PF = 'tt_publicip_host'
const LS_TN = 'tt_tunnel_url'

export default function InviteModal({ net, boardName, onClose }) {
  // net = { ip, port, tailscaleIp, boardId }
  const [mode, setMode] = useState('lan')   // lan | ts | pf | tunnel
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const port = net?.port || '8766'
  const boardId = net?.boardId

  // --- Tailscale ---
  const [tsHost, setTsHost] = useState('')
  const [detectedIp, setDetectedIp] = useState(net?.tailscaleIp || '')
  const [tsRefreshing, setTsRefreshing] = useState(false)
  const refreshTs = async () => {
    setTsRefreshing(true)
    const n = await api.netInfo(); setTsRefreshing(false)
    if (n && !n.error && n.tailscale_ip) { setDetectedIp(n.tailscale_ip); setTsHost(n.tailscale_ip) }
  }

  // --- Port forwarding ---
  const [pfHost, setPfHost] = useState('')
  const [pfDetecting, setPfDetecting] = useState(false)
  const detectPublicIp = async () => {
    setPfDetecting(true)
    const r = await api.publicIp(); setPfDetecting(false)
    if (r && !r.error && r.ip) setPfHost(r.ip)
  }

  // --- Tunnel ---
  const [tunUrl, setTunUrl] = useState('')

  useEffect(() => {
    if (net?.tailscaleIp) { setTsHost(net.tailscaleIp) }
    else { try { const s = localStorage.getItem(LS_TS); if (s) setTsHost(s) } catch {} }
    try { const s = localStorage.getItem(LS_PF); if (s) setPfHost(s) } catch {}
    try { const s = localStorage.getItem(LS_TN); if (s) setTunUrl(s) } catch {}
  }, [net?.tailscaleIp])

  const clean = (v) => v.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const lanLink = `http://${net?.ip}:${port}/?join=${boardId}`
  const tsLink = clean(tsHost) ? `http://${clean(tsHost)}:${port}/?join=${boardId}` : ''
  const pfLink = clean(pfHost) ? `http://${clean(pfHost)}:${port}/?join=${boardId}` : ''
  const tunBase = tunUrl.trim().replace(/\/+$/, '')
  const tunLink = tunBase ? `${tunBase}/?join=${boardId}` : ''

  const link = mode === 'lan' ? lanLink : mode === 'ts' ? tsLink : mode === 'pf' ? pfLink : tunLink

  const copy = async () => {
    if (!link) return
    try { await navigator.clipboard.writeText(link) } catch {}
    try {
      if (mode === 'ts') localStorage.setItem(LS_TS, clean(tsHost))
      if (mode === 'pf') localStorage.setItem(LS_PF, clean(pfHost))
      if (mode === 'tunnel') localStorage.setItem(LS_TN, tunBase)
    } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  const TABS = [
    ['lan', 'Одна Wi-Fi сеть'],
    ['ts', 'Tailscale'],
    ['pf', 'Проброс порта'],
    ['tunnel', 'Туннель'],
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invite-icon"><IconLink size={26} /></div>
        <div className="modal-title-static" style={{ textAlign: 'center', width: '100%' }}>Пригласить на доску</div>
        <p className="invite-sub">Ссылка на доску {boardName ? <b>«{boardName}»</b> : ''}. Отправь её человеку — он откроет, зарегистрируется и запросит доступ, а ты одобришь через колокольчик.</p>

        <div className="invite-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={'invite-tab' + (mode === k ? ' active' : '')} onClick={() => { setMode(k); setShowHelp(false) }}>{label}</button>
          ))}
        </div>

        {mode === 'ts' && (
          <div className="invite-ts">
            {detectedIp
              ? <div className="invite-detected">✓ Адрес устройства найден автоматически: <b>{detectedIp}</b></div>
              : <div className="invite-detected warn">
                  <div>Tailscale-адрес не найден. Запусти Tailscale, затем нажми «Обновить», либо введи адрес вручную.</div>
                  <button type="button" className="invite-refresh" disabled={tsRefreshing} onClick={refreshTs}>{tsRefreshing ? 'Проверяю…' : '↻ Обновить'}</button>
                </div>}
            <label className="invite-ts-label">Твой Tailscale-адрес (IP вида 100.x.x.x)</label>
            <input className="invite-link-input" placeholder="100.101.102.103" value={tsHost} onChange={(e) => setTsHost(e.target.value)} />
            <button type="button" className="invite-help-toggle" onClick={() => setShowHelp(v => !v)}>{showHelp ? '▾ Скрыть' : '▸ Где взять свой адрес 100.x.x.x?'}</button>
            {showHelp && (
              <div className="invite-help">
                <div className="invite-help-step"><b>1.</b> Установи Tailscale — <span className="invite-help-url">tailscale.com/download</span> — и войди в свой аккаунт (тем же, что и гость).</div>
                <div className="invite-help-step"><b>2.</b> Открой приложение Tailscale на этом компьютере.</div>
                <div className="invite-help-step"><b>3.</b> Windows — клик по значку Tailscale в трее → строка <b>This device</b>, адрес вида <b>100.x.x.x</b> (можно «Copy IP address»).</div>
                <div className="invite-help-step"><b>4.</b> Вставь адрес в поле выше — он запомнится.</div>
                <div className="invite-help-note">Адрес не меняется при смене Wi-Fi. Гость тоже должен держать Tailscale запущенным.</div>
              </div>
            )}
          </div>
        )}

        {mode === 'pf' && (
          <div className="invite-ts">
            {clean(pfHost)
              ? <div className="invite-detected">Публичный IP: <b>{clean(pfHost)}</b> · порт <b>{port}</b></div>
              : <div className="invite-detected warn">
                  <div>Укажи свой публичный IP или определи его автоматически.</div>
                  <button type="button" className="invite-refresh" disabled={pfDetecting} onClick={detectPublicIp}>{pfDetecting ? 'Определяю…' : '↻ Определить мой IP'}</button>
                </div>}
            <label className="invite-ts-label">Публичный IP (внешний адрес твоей сети)</label>
            <div className="invite-link-row" style={{ marginBottom: 8 }}>
              <input className="invite-link-input" placeholder="93.184.216.34" value={pfHost} onChange={(e) => setPfHost(e.target.value)} />
              <button className="btn-primary invite-copy" disabled={pfDetecting} onClick={detectPublicIp}>{pfDetecting ? '…' : 'Определить'}</button>
            </div>
            <button type="button" className="invite-help-toggle" onClick={() => setShowHelp(v => !v)}>{showHelp ? '▾ Скрыть' : '▸ Как пробросить порт на роутере?'}</button>
            {showHelp && (
              <div className="invite-help">
                <div className="invite-help-step"><b>1.</b> Зайди в настройки роутера (обычно <b>192.168.0.1</b> или <b>192.168.1.1</b> в браузере).</div>
                <div className="invite-help-step"><b>2.</b> Найди раздел <b>Port Forwarding</b> / «Проброс портов» / «Виртуальные серверы».</div>
                <div className="invite-help-step"><b>3.</b> Добавь правило: внешний порт <b>{port}</b> → внутренний IP этого компьютера (<b>{net?.ip}</b>), внутренний порт <b>{port}</b>, протокол TCP.</div>
                <div className="invite-help-step"><b>4.</b> Нажми «Определить мой IP» выше — гость откроет ссылку из этого окна.</div>
                <div className="invite-help-note warn-note">Нужен «белый» (публичный) IP от провайдера — если ссылка не открывается снаружи, скорее всего IP серый, тогда используй Tailscale или туннель. Соединение без шифрования — менее безопасно.</div>
              </div>
            )}
          </div>
        )}

        {mode === 'tunnel' && (
          <div className="invite-ts">
            <div className="invite-detected info">Запусти туннель у себя и вставь публичную ссылку, которую он выдал.</div>
            <label className="invite-ts-label">Публичный адрес туннеля</label>
            <input className="invite-link-input" placeholder="https://xxxx.ngrok-free.app" value={tunUrl} onChange={(e) => setTunUrl(e.target.value)} />
            <button type="button" className="invite-help-toggle" onClick={() => setShowHelp(v => !v)}>{showHelp ? '▾ Скрыть' : '▸ Как запустить туннель (ngrok / cloudflared)?'}</button>
            {showHelp && (
              <div className="invite-help">
                <div className="invite-help-step"><b>ngrok:</b> скачай на <span className="invite-help-url">ngrok.com/download</span>, зарегистрируйся, добавь токен, затем в терминале: <b>ngrok http {port}</b>.</div>
                <div className="invite-help-step"><b>cloudflared:</b> установи и запусти: <b>cloudflared tunnel --url http://localhost:{port}</b>.</div>
                <div className="invite-help-step">Программа выдаст ссылку вида <b>https://xxxx.ngrok-free.app</b> — вставь её в поле выше.</div>
                <div className="invite-help-note warn-note">Гостю ставить ничего не нужно. Но адрес меняется при каждом запуске (на бесплатном тарифе), и туннель — сторонний посредник. Держи туннель и ThingTracker запущенными, пока гость работает.</div>
              </div>
            )}
          </div>
        )}

        <div className="invite-link-row">
          <input className="invite-link-input" readOnly value={link || 'Заполни поле выше'} onFocus={(e) => e.target.select()} />
          <button className="btn-primary invite-copy" disabled={!link} onClick={copy}>{copied ? 'Скопировано ✓' : 'Копировать'}</button>
        </div>

        {mode === 'lan' && <div className="invite-hint">Человек должен быть в той же Wi-Fi сети. С телефона — открыть ссылку в браузере и «На экран Домой».</div>}

        <div className="modal-actions">
          <div style={{ flex: 1 }}></div>
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  )
}
