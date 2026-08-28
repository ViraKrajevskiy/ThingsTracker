import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api.js'

function IconBell({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  )
}

function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return 'только что'
  if (s < 3600) return Math.floor(s / 60) + ' мин'
  if (s < 86400) return Math.floor(s / 3600) + ' ч'
  return Math.floor(s / 86400) + ' дн'
}

export default function Notifications({ onChanged }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [requests, setRequests] = useState([])
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
  const approve = async (rid, role) => { await api.approveJoin(rid, role); await loadAll(); onChanged && onChanged() }
  const deny = async (rid) => { await api.denyJoin(rid); await loadAll() }

  return (
    <div className="notif" ref={ref}>
      <button className="btn-icon notif-btn" title="Уведомления" onClick={toggle}>
        <IconBell size={18} />
        {count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
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
            <div className="notif-title">Уведомления</div>
            {items.length === 0 && <div className="no-comments">Пока пусто</div>}
            {items.map(n => (
              <div className={'notif-item' + (n.read ? '' : ' unread')} key={n.id}>
                <div className="notif-text">{n.text}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
