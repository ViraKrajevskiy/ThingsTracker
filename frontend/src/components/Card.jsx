import React, { useState } from 'react'
import { api } from '../api.js'
import { IconUser, IconCalendar, IconTrash, IconPaperclip, IconComment } from './Icons.jsx'

const PRIORITY_COLOR = { low: '#7A97C8', normal: '#35D0F0', high: '#FFC26B', urgent: '#FF7BA6' }

function fmtDate(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
function toInputDate(ts) { return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '' }

export default function Card({ card, members, statuses, onOpen, onChanged, dragProps, canWrite = true }) {
  const [menu, setMenu] = useState(null)
  const st = statuses.find(s => s.id === card.status) || statuses[0] || { label: '—', color: '#7A97C8' }
  const overdue = card.due_date && card.due_date * 1000 < Date.now() && card.status !== 'done'
  const assignee = members.find(m => m.name === card.assignee)

  const patch = async (data) => { await api.updateCard(card.id, data); setMenu(null); onChanged() }
  const remove = async (e) => { e.stopPropagation(); await api.deleteCard(card.id); onChanged() }

  return (
    <div className="card" ref={dragProps.innerRef} {...dragProps.draggableProps} {...dragProps.dragHandleProps}
      onClick={() => onOpen(card)}>
      <span className="card-prio" style={{ background: PRIORITY_COLOR[card.priority] || '#35D0F0' }}></span>

      <div className="card-top">
        <div className="card-title">{card.title}</div>
        {canWrite && (
          <div className="card-tools" onClick={(e) => e.stopPropagation()}>
            <button className="ct-btn" title="Исполнитель" onClick={() => setMenu(menu === 'assignee' ? null : 'assignee')}><IconUser size={14} /></button>
            <button className="ct-btn" title="Дедлайн" onClick={() => setMenu(menu === 'due' ? null : 'due')}><IconCalendar size={14} /></button>
            <button className="ct-btn danger" title="Удалить" onClick={remove}><IconTrash size={14} /></button>
          </div>
        )}
      </div>

      <div className="card-foot" onClick={(e) => e.stopPropagation()}>
        <button className={'status-badge' + (canWrite ? ' clickable' : '')} style={{ '--sc': st.color }}
          onClick={() => { if (canWrite) setMenu(menu === 'status' ? null : 'status') }}>
          <span className="status-dot" style={{ background: st.color }}></span>{st.label}
        </button>
        {card.due_date ? (
          <span className={'due-badge' + (overdue ? ' overdue' : '')}><IconCalendar size={11} /> {fmtDate(card.due_date)}</span>
        ) : null}
        {card.attachment_count > 0 ? <span className="card-ind"><IconPaperclip size={12} /> {card.attachment_count}</span> : null}
        {card.comment_count > 0 ? <span className="card-ind"><IconComment size={12} /> {card.comment_count}</span> : null}
        <span className="card-foot-spacer"></span>
        {assignee ? <span className="card-av" style={{ background: assignee.color }} title={assignee.name}>{assignee.name[0]}</span> : null}
      </div>

      {menu === 'status' && (
        <div className="mini-menu" onClick={(e) => e.stopPropagation()}>
          {statuses.map(s => (
            <button key={s.id} className="mini-item" onClick={() => patch({ status: s.id })}>
              <span className="status-dot" style={{ background: s.color }}></span>{s.label}
            </button>
          ))}
        </div>
      )}
      {menu === 'assignee' && (
        <div className="mini-menu" onClick={(e) => e.stopPropagation()}>
          <button className="mini-item" onClick={() => patch({ assignee: null })}>— не назначен —</button>
          {members.map(m => (
            <button key={m.id} className="mini-item" onClick={() => patch({ assignee: m.name })}>
              <span className="mini-avatar" style={{ background: m.color }}>{m.name[0]}</span>{m.name}
            </button>
          ))}
        </div>
      )}
      {menu === 'due' && (
        <div className="mini-menu" onClick={(e) => e.stopPropagation()}>
          <input type="date" className="date-input" defaultValue={toInputDate(card.due_date)}
            onChange={(e) => { const v = e.target.value; patch({ due_date: v ? new Date(v).getTime() / 1000 : null }) }} />
          {card.due_date ? <button className="mini-item" onClick={() => patch({ due_date: null })}>Убрать дедлайн</button> : null}
        </div>
      )}
    </div>
  )
}
