import React, { useEffect, useState, useRef } from 'react'
import { api, setToken, getToken } from '../api.js'

export default function JoinScreen({ boardId, onJoined, onFallback }) {
  const [board, setBoard] = useState(null)
  const [phase, setPhase] = useState(getToken() ? 'requesting' : 'register') // register | requesting | pending | denied
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState('')
  const poll = useRef(null)
  const isDesktop = !!(window.electronAPI && window.electronAPI.isDesktop)
  const openInApp = () => {
    try { window.location.href = 'thingtracker://open?u=' + encodeURIComponent(window.location.href) } catch (e) {}
  }

  useEffect(() => { (async () => { const b = await api.boardPublic(boardId); if (!b.error) setBoard(b); else setErr('Доска не найдена') })() }, [boardId])

  const startPolling = () => {
    poll.current = setInterval(async () => {
      const a = await api.myAccess(boardId)
      if (a.state === 'member') { clearInterval(poll.current); onJoined() }
      else if (a.state === 'denied') { clearInterval(poll.current); setPhase('denied') }
    }, 4000)
  }
  useEffect(() => {
    if (phase === 'requesting') { (async () => {
      const r = await api.requestJoin(boardId)
      if (r.state === 'member') return onJoined()
      setPhase('pending'); startPolling()
    })() }
    return () => poll.current && clearInterval(poll.current)
  }, [phase])

  const register = async () => {
    setErr('')
    if (!username.trim() || !password) { setErr('Заполни логин и пароль'); return }
    const res = await api.register(username.trim(), password, displayName.trim() || username.trim())
    if (res.error) { setErr(typeof res.error === 'string' ? res.error : 'Ошибка'); return }
    setToken(res.token)
    setPhase('requesting')
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><span></span><span></span><span></span><span></span></div>
          <span className="brand-name">ThingTracker</span>
        </div>

        {board && <div className="join-board">Присоединение к доске<br /><b style={{ color: board.color }}>{board.name}</b></div>}

        {!isDesktop && (
          <button className="open-in-app" onClick={openInApp} title="Открыть в установленном приложении ThingTracker">
            Открыть в приложении ThingTracker
          </button>
        )}

        {phase === 'register' && (
          <>
            <label className="field-label">Логин</label>
            <input className="modal-input" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="логин" />
            <label className="field-label">Имя</label>
            <input className="modal-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как вас показывать" />
            <label className="field-label">Пароль</label>
            <input className="modal-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') register() }} placeholder="пароль" />
            {err ? <div className="auth-err">{err}</div> : null}
            <button className="btn-primary auth-submit" onClick={register}>Зарегистрироваться и запросить доступ</button>
            <div className="auth-hint">Уже есть аккаунт? <a className="link-btn" onClick={onFallback}>Войти</a></div>
          </>
        )}

        {(phase === 'requesting' || phase === 'pending') && (
          <div className="join-status">
            <div className="spinner"></div>
            Запрос на доступ отправлен.<br />Ожидаем одобрения администратора доски…
          </div>
        )}
        {phase === 'denied' && (
          <div className="join-status denied">Администратор отклонил запрос на доступ.</div>
        )}
      </div>
    </div>
  )
}
