import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import Attachments from './Attachments.jsx'
import { IconPaperclip } from './Icons.jsx'
import Poll from './Poll.jsx'

const PRIORITIES = [
  { v: 'low', label: 'Низкий', c: '#7A97C8' },
  { v: 'normal', label: 'Обычный', c: '#00D4FF' },
  { v: 'high', label: 'Высокий', c: '#FFB347' },
  { v: 'urgent', label: 'Срочный', c: '#FF6B9D' },
]

function toInputDate(ts) { return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '' }
function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CardModal({ card, members, statuses, onClose, onSaved, canEdit = true, canMove = true, canDelete = true, canComment = true, canDeadline = true }) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [priority, setPriority] = useState(card.priority || 'normal')
  const [status, setStatus] = useState(card.status || (statuses[0] && statuses[0].id) || 'open')
  const [assignee, setAssignee] = useState(card.assignee || '')
  const [due, setDue] = useState(toInputDate(card.due_date))
  const [saving, setSaving] = useState(false)

  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const commentFileRef = React.useRef(null)
  const [attReload, setAttReload] = useState(0)

  const loadComments = async () => setComments(await api.comments(card.id))
  useEffect(() => { loadComments() }, [card.id])

  const save = async () => {
    setSaving(true)
    await api.updateCard(card.id, {
      title, description, priority, status,
      assignee: assignee || null,
      due_date: due ? new Date(due).getTime() / 1000 : null,
    })
    onSaved()
  }
  const remove = async () => { await api.deleteCard(card.id); onSaved() }
  const sendComment = async () => {
    if (!commentText.trim()) return
    const me = members[0]?.name || 'Я'
    await api.addComment(card.id, me, commentText.trim())
    setCommentText(''); loadComments()
  }
  const delComment = async (id) => { await api.deleteComment(id); loadComments() }
  const attachInComment = async (files) => {
    for (const f of Array.from(files)) await api.uploadAttachment(card.id, f)
    setAttReload(x => x + 1)
    const me = members[0]?.name || 'Я'
    await api.addComment(card.id, me, 'Прикреплён файл: ' + Array.from(files).map(f => f.name).join(', '))
    loadComments()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <input className="modal-title" value={title}
            onChange={(e) => setTitle(e.target.value)} placeholder="Название задачи" />
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-cols">
          <div className="modal-main">
            <label className="field-label">Описание</label>
            <textarea className="modal-desc" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Добавь детали, чеклист, ссылки…" rows={5} />

            <label className="field-label">Комментарии</label>
            <div className="comments">
              {comments.length === 0 && <div className="no-comments">Пока нет комментариев</div>}
              {comments.map(c => (
                <div className="comment" key={c.id}>
                  <div className="comment-head">
                    <span className="comment-author">{c.author || 'Аноним'}</span>
                    <span className="comment-time">{fmtTime(c.created_at)}</span>
                    <button className="comment-del" onClick={() => delComment(c.id)}>×</button>
                  </div>
                  <div className="comment-text">{c.text}</div>
                </div>
              ))}
            </div>
            {canComment ? (
            <div className="comment-add">
              <input ref={commentFileRef} type="file" multiple hidden
                onChange={(e) => { if (e.target.files?.length) attachInComment(e.target.files) }} />
              <button className="ct-btn comment-clip" title="Прикрепить файл" onClick={() => commentFileRef.current?.click()}><IconPaperclip size={15} /></button>
              <input className="modal-input" placeholder="Написать комментарий…" value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendComment() }} />
              <button className="btn-primary sm" onClick={sendComment}>Отправить</button>
            </div>
            ) : <div className="perm-noaccess">Нет прав комментировать</div>}

            <label className="field-label">Вложения</label>
            <Attachments cardId={card.id} key={attReload} />

            <label className="field-label">Опрос</label>
            <Poll cardId={card.id} api={api} canEdit={canEdit} />
          </div>

          <div className="modal-side">
            <label className="field-label">Статус</label>
            <div className="chip-col">
              {statuses.map(s => (
                <button key={s.id} className={'prio-chip' + (status === s.id ? ' active' : '')}
                  style={{ '--pc': s.color }} onClick={() => setStatus(s.id)}>
                  <span className="prio-dot" style={{ background: s.color }}></span>{s.label}
                </button>
              ))}
            </div>

            <label className="field-label">Приоритет</label>
            <div className="chip-col">
              {PRIORITIES.map(p => (
                <button key={p.v} className={'prio-chip' + (priority === p.v ? ' active' : '')}
                  style={{ '--pc': p.c }} onClick={() => setPriority(p.v)}>
                  <span className="prio-dot" style={{ background: p.c }}></span>{p.label}
                </button>
              ))}
            </div>

            <label className="field-label">Исполнитель</label>
            <select className="modal-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— не назначен —</option>
              {members.map(m => <option key={m.id} value={m.name}>{m.name} ({m.role})</option>)}
            </select>

            <label className="field-label">Дедлайн</label>
            <input type="date" className="modal-select" value={due} disabled={!canDeadline} onChange={(e) => setDue(e.target.value)} />
            {!canDeadline && <div className="perm-noaccess">Нет прав ставить дедлайны</div>}
          </div>
        </div>

        <div className="modal-actions">
          {canDelete && <button className="btn-danger" onClick={remove}>Удалить</button>}
          <div style={{ flex: 1 }}></div>
          <button className="btn-ghost" onClick={onClose}>{(canEdit || canMove) ? 'Отмена' : 'Закрыть'}</button>
          {(canEdit || canMove) && <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>}
        </div>
      </div>
    </div>
  )
}
