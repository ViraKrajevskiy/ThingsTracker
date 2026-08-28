import React, { useState } from 'react'

export const BOARD_COLORS = [
  '#00D4FF', '#00E5A0', '#FFB347', '#A78BFA', '#FF6B9D', '#5B8DEF', '#F97316', '#22D3EE',
]

const BOARD_TYPES = [
  { v: 'kanban', label: 'Kanban', desc: 'Бэклог · В работе · Готово' },
  { v: 'scrum',  label: 'Scrum / Спринт', desc: '5 колонок с проверкой' },
  { v: 'simple', label: 'Простая', desc: 'Сделать · Готово' },
  { v: 'blank',  label: 'Пустая', desc: 'Без колонок' },
]

// mode: 'create' -> name + type + color ; 'edit' -> name + color (type fixed)
export default function BoardModal({ mode = 'create', board, defaults, onClose, onSubmit, onDelete }) {
  const [confirmDel, setConfirmDel] = React.useState(false)
  const [name, setName] = useState(board?.name || '')
  const [type, setType] = useState(board?.board_type || defaults?.board_type || 'kanban')
  const [color, setColor] = useState(board?.color || defaults?.color || '#00D4FF')
  const [rolesEnabled, setRolesEnabled] = useState(board ? board.roles_enabled !== 0 : true)
  const [requireApproval, setRequireApproval] = useState(board ? board.require_approval !== 0 : true)
  const [acceptMembers, setAcceptMembers] = useState(board ? board.accept_members !== 0 : true)

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), board_type: type, color,
      roles_enabled: rolesEnabled ? 1 : 0, require_approval: requireApproval ? 1 : 0, accept_members: acceptMembers ? 1 : 0 })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title-static">
            {mode === 'create' ? 'Новая доска' : 'Дизайн доски'}
          </span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <label className="field-label">Название</label>
        <input className="modal-input" autoFocus value={name}
          placeholder="Например: Спринт 1"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />

        {mode === 'create' && (
          <>
            <label className="field-label">Тип доски</label>
            <div className="type-grid">
              {BOARD_TYPES.map(t => (
                <button key={t.v}
                  className={'type-card' + (type === t.v ? ' active' : '')}
                  style={{ '--tc': color }}
                  onClick={() => setType(t.v)}>
                  <span className="type-name">{t.label}</span>
                  <span className="type-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="field-label">Цвет доски</label>
        <div className="color-row">
          {BOARD_COLORS.map(c => (
            <button key={c}
              className={'color-swatch' + (color === c ? ' active' : '')}
              style={{ background: c }}
              onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>

        {mode === 'edit' && (
          <>
            <label className="field-label">Доступ к доске</label>
            <div className="toggle-row" onClick={() => setRolesEnabled(v => !v)}>
              <span className={'toggle' + (rolesEnabled ? ' on' : '')}><span className="toggle-knob"></span></span>
              <div className="toggle-text"><b>Роли и права</b><span>Выкл — все участники равны и могут всё</span></div>
            </div>
            <div className="toggle-row" onClick={() => setRequireApproval(v => !v)}>
              <span className={'toggle' + (requireApproval ? ' on' : '')}><span className="toggle-knob"></span></span>
              <div className="toggle-text"><b>Одобрение при входе</b><span>Выкл — по ссылке заходят сразу, без одобрения</span></div>
            </div>
            <div className="toggle-row" onClick={() => setAcceptMembers(v => !v)}>
              <span className={'toggle' + (acceptMembers ? ' on' : '')}><span className="toggle-knob"></span></span>
              <div className="toggle-text"><b>Приём новых участников</b><span>Выкл — доска закрыта, присоединиться нельзя</span></div>
            </div>
          </>
        )}

        <div className="modal-actions">
          {mode === 'edit' && onDelete && (confirmDel ? (
            <span className="list-confirm">
              <button className="lc-yes" onClick={onDelete}>Удалить доску</button>
              <button className="lc-no" onClick={() => setConfirmDel(false)}>×</button>
            </span>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDel(true)}>Удалить доску</button>
          ))}
          <div style={{ flex: 1 }}></div>
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={submit}>
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
