import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api.js'

const MUTE_KEY = 'tt_notif_muted'

function IconBell({ size = 18, muted = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />}
    </svg>
  )
}

// small icon per notification type
function TypeIcon({ type }) {
  const s = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'join_request') return <svg {...s}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
  if (type === 'member_joined') return <svg {...s}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11l-3 3-2-2" /></svg>
  if (type === 'access_granted') return <svg {...s}><path d="M20 6L9 17l-5-5" /></svg>
  if (type === 'access_denied') return <svg {...s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  // card_change / default
  return <svg {...s}><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="11" rx="1" /></svg>
}

function typeClass(type) {
  if (type === 'join_request') return 'nt-request'
  if (type === 'member_joined' || type === 'access_granted') return 'nt-ok'
  if (type === 'access_denied') return 'nt-bad'
  return 'nt-card'
}

function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return 'только что'
  if (s < 3600) return Math.floor(s / 60) + ' мин'
  if (s < 86400) return Math.floor(s / 3600) + ' ч'
  return Math.floor(s / 86400) + ' дн'
}

// collapse consecutive identical notifications into one with a count
function collapse(items) {
  const out = []
  for (const n of items) {
    const last = out[out.length - 1]
    if (last && last.type === n.type && last.text === n.text) {
      last.dup = (last.dup || 1) + 1
    } else {
      out.push({ ...n, dup: 1 })
    }
  }
  return out
}

export default function Notifications({ onChanged }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [requests, setRequests] = useState([])
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })
  const ref = useRef(null)

  const refreshCount = async () => { const r = await api.notifCount(); if (!r.error) setCount(r.count || 0) }
  const loadAll = async () => {
    const n = await api.notifications(); if (!n.error) setItems(n)
    const jr = await api.joinRequests(); if (!jr.error) setRequests(jr)
  }

  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 12000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (open) { loadAll() }
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = async () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) { await loadAll(); await api.notifReadAll(); setCount(0) }
  }
  const toggleMute = () => {
    setMuted(m => { const v = !m; try { localStorage.setItem(MUTE_KEY, v ? '1' : '0') } catch {}; return v })
  }
  const clearAll = async () => { await api.notifReadAll(); setItems([]); setCount(0) }
  const approve = async (rid, role) => { await api.approveJoin(rid, role); await loadAll(); onChanged && onChanged() }
  const deny = async (rid) => { await api.denyJoin(rid); await loadAll() }

  const shown = collapse(items)

  return (
    <div className="notif" ref={ref}>
      <button className={'btn-icon notif-btn' + (muted ? ' muted' : '')} title="Уведомления" onClick={toggle}>
        <IconBell size={18} muted={muted} />
        {!muted && count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span className="notif-head-title">Уведомления</span>
            <div className="notif-head-actions">
              <button className={'notif-mute' + (muted ? ' on' : '')} onClick={toggleMute} title={muted ? 'Включить уведомления' : 'Отключить уведомления'}>
                <IconBell size={14} muted={muted} /> {muted ? 'Выкл' : 'Вкл'}
              </button>
              {items.length > 0 && <button className="notif-clear" onClick={clearAll}>Очистить</button>}
            </div>
          </div>

          {requests.length > 0 && (
            <div className="notif-section">
              <div className="notif-title">Заявки на доступ</div>
              {requests.map(r => (
                <div className="req-row" key={r.id}>
                  <span className="mini-avatar" style={{ background: r.color }}>{r.display_name[0]}</span>
                  <div className="req-info">
                    <div className="req-name">{r.display_name} <span className="member-login">@{r.username}</span></div>
                    <div className="req-board">доска «{r.board_name}»</div>
                  </div>
                  <select className="role-select sm" defaultValue="member" id={'role-' + r.id}>
                    <option value="admin">Админ</option>
                    <option value="member">Участник</option>
                    <option value="viewer">Наблюдатель</option>
                  </select>
                  <button className="lc-yes" onClick={() => approve(r.id, document.getElementById('role-' + r.id).value)}>✓</button>
                  <button className="lc-no" onClick={() => deny(r.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className="notif-section">
            {shown.length === 0 && <div className="notif-empty">Пока пусто</div>}
            {shown.map(n => (
              <div className={'notif-item ' + typeClass(n.type) + (n.read ? '' : ' unread')} key={n.id}>
                <span className="notif-ic"><TypeIcon type={n.type} /></span>
                <div className="notif-body">
                  <div className="notif-text">{n.text}{n.dup > 1 && <span className="notif-dup">×{n.dup}</span>}</div>
                  <div className="notif-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
