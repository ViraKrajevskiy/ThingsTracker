import React, { useState } from 'react'
import { api, setToken } from '../api.js'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const enterAsOwner = async () => {
    setErr('')
    const bs = await api.bootstrap()
    if (bs && !bs.error) { setToken(bs.token); onAuthed(bs.user) }
    else setErr('Кнопка работает только на компьютере-владельце')
  }

  const submit = async () => {
    setErr(''); setBusy(true)
    const res = mode === 'login'
      ? await api.login(username.trim(), password)
      : await api.register(username.trim(), password, displayName.trim() || username.trim())
    setBusy(false)
    if (res.error) { setErr(typeof res.error === 'string' ? res.error : 'Ошибка входа'); return }
    setToken(res.token)
    onAuthed(res.user)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><span></span><span></span><span></span><span></span></div>
          <span className="brand-name">ThingTracker</span>
        </div>
        <div className="auth-tabs">
          <button className={'auth-tab' + (mode === 'login' ? ' active' : '')} onClick={() => setMode('login')}>Вход</button>
          <button className={'auth-tab' + (mode === 'register' ? ' active' : '')} onClick={() => setMode('register')}>Регистрация</button>
        </div>

        <label className="field-label">Логин</label>
        <input className="modal-input" autoComplete="off" name="tt-login" autoFocus value={username} placeholder="логин"
          onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />

        {mode === 'register' && (
          <>
            <label className="field-label">Отображаемое имя</label>
            <input className="modal-input" value={displayName} placeholder="Как вас показывать"
              onChange={(e) => setDisplayName(e.target.value)} />
          </>
        )}

        <label className="field-label">Пароль</label>
        <input className="modal-input" type="password" autoComplete="off" name="tt-pass" value={password} placeholder="пароль"
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />

        {err ? <div className="auth-err">{err}</div> : null}

        <button className="btn-primary auth-submit" onClick={submit} disabled={busy}>
          {busy ? '…' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
        </button>
        <button className="btn-ghost auth-owner" onClick={enterAsOwner}>Войти как владелец (этот компьютер)</button>

        {mode === 'login' && (
          <div className="auth-hint">Первый вход: <b>admin</b> / <b>admin1234</b> — потом смени пароль в настройках.</div>
        )}
      </div>
    </div>
  )
}
