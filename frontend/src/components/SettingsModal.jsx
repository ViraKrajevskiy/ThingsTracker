import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { BOARD_COLORS } from './BoardModal.jsx'

const SWATCHES = ['#7A97C8', '#35D0F0', '#34E0A8', '#FFC26B', '#A98BFF', '#FF7BA6', '#5B8DEF', '#F97316']
const ROLE_LABEL = { admin: 'Админ', member: 'Участник', viewer: 'Наблюдатель' }

export default function SettingsModal({ onClose, onChanged, currentUser, activeBoard }) {
  const isOwner = currentUser?.global_role === 'owner'
  const isBoardAdmin = activeBoard?.my_role === 'admin'
  const [tab, setTab] = useState('statuses')
  const [statuses, setStatuses] = useState([])
  const [settings, setSettings] = useState({})
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#35D0F0')

  // users
  const [users, setUsers] = useState([])
  const [nuName, setNuName] = useState('')
  const [nuDisplay, setNuDisplay] = useState('')
  const [nuPass, setNuPass] = useState('')
  const [nuRole, setNuRole] = useState('user')
  const [createdCreds, setCreatedCreds] = useState(null)

  // board members
  const [bmembers, setBmembers] = useState([])

  const loadCore = async () => { setStatuses(await api.statuses()); setSettings(await api.settings()) }
  const loadUsers = async () => setUsers(await api.users())
  const loadMembers = async () => { if (activeBoard) setBmembers(await api.boardMembers(activeBoard.id)) }
  useEffect(() => { loadCore(); if (isOwner) loadUsers(); loadMembers() }, [])

  const addStatus = async () => { if (!newLabel.trim()) return; await api.createStatus(newLabel.trim(), newColor); setNewLabel(''); await loadCore(); onChanged() }
  const editStatus = async (id, data) => { await api.updateStatus(id, data); await loadCore(); onChanged() }
  const removeStatus = async (id) => { await api.deleteStatus(id); await loadCore(); onChanged() }
  const saveSetting = async (k, v) => { const next = { ...settings, [k]: v }; setSettings(next); await api.updateSettings({ [k]: v }); if (onChanged) onChanged() }

  const createUser = async () => {
    if (!nuName.trim() || !nuDisplay.trim()) { alert('Заполни логин и имя'); return }
    const res = await api.createUser({ username: nuName.trim(), display_name: nuDisplay.trim(), password: nuPass, global_role: nuRole })
    if (res.error) { alert(typeof res.error === 'string' ? res.error : 'Ошибка'); return }
    setCreatedCreds({ username: res.username, password: nuPass || '(пользователь задаст сам при регистрации)' })
    setNuName(''); setNuDisplay(''); setNuPass(''); setNuRole('user')
    loadUsers()
  }
  const delUser = async (id) => { await api.deleteUser(id); loadUsers() }

  const removeMember = async (userId) => { await api.removeBoardMember(activeBoard.id, userId); loadMembers() }
  const memberRole = (uid) => bmembers.find(m => m.id === uid)?.role
  const memberPerms = (uid) => bmembers.find(m => m.id === uid)?.permissions || {}
  const setAccess = async (userId, role, permissions) => { await api.addBoardMember(activeBoard.id, userId, role, permissions); loadMembers() }
  const toggleAdmin = async (u) => {
    if (memberRole(u.id) === 'admin') await setAccess(u.id, 'member', {})
    else await setAccess(u.id, 'admin', null)
  }
  const togglePerm = async (u, key) => {
    const cur = memberPerms(u.id)
    const next = { ...cur, [key]: !cur[key] }
    const anyOn = Object.values(next).some(Boolean)
    if (!anyOn && memberRole(u.id) !== 'admin') await removeMember(u.id)
    else await setAccess(u.id, 'member', next)
  }
  const PERM_LABELS = [
    { k: 'create_cards', l: 'Создавать' },
    { k: 'edit_cards', l: 'Редактировать' },
    { k: 'move_cards', l: 'Перемещать' },
    { k: 'delete_cards', l: 'Удалять' },
    { k: 'set_deadline', l: 'Дедлайны' },
    { k: 'manage_columns', l: 'Колонки' },
    { k: 'manage_swimlanes', l: 'Свимлейны' },
    { k: 'manage_members', l: 'Участники' },
    { k: 'comment', l: 'Комментарии' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title-static">Настройки</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tabs">
          <button className={'tab' + (tab === 'statuses' ? ' active' : '')} onClick={() => setTab('statuses')}>Статусы</button>
          <button className={'tab' + (tab === 'defaults' ? ' active' : '')} onClick={() => setTab('defaults')}>Базовые параметры</button>
          {activeBoard && <button className={'tab' + (tab === 'members' ? ' active' : '')} onClick={() => setTab('members')}>Участники доски</button>}
          {isOwner && <button className={'tab' + (tab === 'users' ? ' active' : '')} onClick={() => setTab('users')}>Пользователи</button>}
        </div>

        {tab === 'statuses' && (
          <div className="status-editor">
            {statuses.map(s => (
              <div className="status-row" key={s.id}>
                <div className="color-pop">
                  <span className="status-dot lg" style={{ background: s.color }}></span>
                  <div className="color-choices">
                    {SWATCHES.map(c => <button key={c} className="color-mini" style={{ background: c }} onClick={() => editStatus(s.id, { color: c })} />)}
                  </div>
                </div>
                <input className="status-name-input" defaultValue={s.label}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.label) editStatus(s.id, { label: e.target.value.trim() }) }} />
                <button className="status-del" title="Удалить" onClick={() => removeStatus(s.id)}>×</button>
              </div>
            ))}
            <div className="status-add">
              <span className="status-dot lg" style={{ background: newColor }}></span>
              <div className="color-choices inline">
                {SWATCHES.map(c => <button key={c} className={'color-mini' + (newColor === c ? ' on' : '')} style={{ background: c }} onClick={() => setNewColor(c)} />)}
              </div>
              <input className="status-name-input" placeholder="Новый статус" value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addStatus() }} />
              <button className="btn-primary sm" onClick={addStatus}>Добавить</button>
            </div>
            <p className="hint">Статусы общие для всех досок.</p>
          </div>
        )}

        {tab === 'defaults' && (
          <div className="defaults-editor">
            <label className="field-label">Тип новых досок по умолчанию</label>
            <select className="modal-select" value={settings.default_board_type || 'kanban'} onChange={(e) => saveSetting('default_board_type', e.target.value)}>
              <option value="kanban">Kanban</option><option value="scrum">Scrum / Спринт</option>
              <option value="simple">Простая</option><option value="blank">Пустая</option>
            </select>
            <label className="field-label">Цвет новых досок по умолчанию</label>
            <div className="color-row">
              {BOARD_COLORS.map(c => <button key={c} className={'color-swatch' + (settings.default_color === c ? ' active' : '')} style={{ background: c }} onClick={() => saveSetting('default_color', c)} />)}
            </div>
          </div>
        )}

        {tab === 'members' && activeBoard && (
          <div className="members-editor">
            {!isBoardAdmin && <p className="hint">Управлять участниками может только админ доски.</p>}
            {users.length === 0 && isOwner ? <p className="hint">Сначала создай пользователей во вкладке «Пользователи».</p> : null}
            <div className="member-list">
              {(isOwner ? users : bmembers).filter(u => u.id !== currentUser.id).map(u => {
                const role = memberRole(u.id)
                const perms = memberPerms(u.id)
                const isAdm = role === 'admin'
                const hasAccess = !!role
                return (
                  <div className="perm-row" key={u.id}>
                    <div className="perm-head">
                      <span className="mini-avatar" style={{ background: u.color }}>{u.display_name[0]}</span>
                      <span className="member-name">{u.display_name} <span className="member-login">@{u.username}</span></span>
                      {hasAccess ? <button className="perm-remove" disabled={!isBoardAdmin} onClick={() => removeMember(u.id)}>убрать</button> : null}
                    </div>
                    <div className="perm-checks">
                      <label className={'perm-chk admin' + (isAdm ? ' on' : '')}>
                        <input type="checkbox" checked={isAdm} disabled={!isBoardAdmin} onChange={() => toggleAdmin(u)} /> Админ
                      </label>
                      {PERM_LABELS.map(pl => (
                        <label key={pl.k} className={'perm-chk' + ((isAdm || perms[pl.k]) ? ' on' : '')}>
                          <input type="checkbox" checked={isAdm || !!perms[pl.k]} disabled={!isBoardAdmin || isAdm}
                            onChange={() => togglePerm(u, pl.k)} /> {pl.l}
                        </label>
                      ))}
                    </div>
                    {!hasAccess && <div className="perm-noaccess">нет доступа к доске</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'users' && isOwner && (
          <div className="users-editor">
            <div className="user-create">
              <label className="field-label">Логин</label>
              <input className="modal-input" placeholder="например ivan" value={nuName} onChange={(e) => setNuName(e.target.value)} />
              <label className="field-label">Отображаемое имя</label>
              <input className="modal-input" placeholder="Иван Петров" value={nuDisplay} onChange={(e) => setNuDisplay(e.target.value)} />
              <label className="field-label">Временный пароль (можно оставить пустым)</label>
              <input className="modal-input" placeholder="временный пароль" value={nuPass} onChange={(e) => setNuPass(e.target.value)} />
              <label className="field-label">Глобальная роль</label>
              <select className="modal-select" value={nuRole} onChange={(e) => setNuRole(e.target.value)}>
                <option value="user">Пользователь</option><option value="owner">Владелец</option>
              </select>
              <button className="btn-primary" style={{ marginTop: '0.8rem', width: '100%' }} onClick={createUser}>Создать пользователя</button>
            </div>
            {createdCreds && (
              <div className="creds-box">
                Создан пользователь. Передай ему данные:<br />
                логин: <b>{createdCreds.username}</b> · пароль: <b>{createdCreds.password}</b>
              </div>
            )}
            <div className="member-list">
              {users.map(u => (
                <div className="member-row" key={u.id}>
                  <span className="mini-avatar" style={{ background: u.color }}>{u.display_name[0]}</span>
                  <span className="member-name">{u.display_name} <span className="member-login">@{u.username}</span> {u.global_role === 'owner' ? '· владелец' : ''} {u.activated ? '' : '· не активирован'}</span>
                  {u.id !== currentUser.id && <button className="status-del" title="Удалить" onClick={() => delUser(u.id)}>×</button>}
                </div>
              ))}
            </div>
            <p className="hint">Создай пользователя с временным паролем и передай ему логин+пароль — он войдёт и сменит его. Роль на конкретной доске задаётся во вкладке «Участники доски».</p>
          </div>
        )}

        <div className="modal-actions">
          <div style={{ flex: 1 }}></div>
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  )
}
