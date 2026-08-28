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
export default function BoardModal({ mode = 'create', board, defaults, onClose, onSubmit }) {
  const [name, setName] = useState(board?.name || '')
  const [type, setType] = useState(board?.board_type || defaults?.board_type || 'kanban')
  const [color, setColor] = useState(board?.color || defaults?.color || '#00D4FF')

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), board_type: type, color })
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

        <div className="modal-actions">
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
