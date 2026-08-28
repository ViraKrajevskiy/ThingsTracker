import React, { useEffect, useState } from 'react'

export default function Poll({ cardId, api, canEdit }) {
  const [poll, setPoll] = useState(null)
  const [editing, setEditing] = useState(false)
  const [multi, setMulti] = useState(false)
  const [options, setOptions] = useState(['', ''])

  const load = async () => { const d = await api.poll(cardId); if (!d.error) setPoll(d) }
  useEffect(() => { load() }, [cardId])

  const startEdit = () => {
    if (poll && poll.is_poll) { setMulti(poll.multi); setOptions(poll.options.map(o => o.text)) }
    else { setMulti(false); setOptions(['', '']) }
    setEditing(true)
  }
  const save = async () => {
    const opts = options.map(o => o.trim()).filter(Boolean)
    if (opts.length < 2) { alert('Нужно минимум 2 варианта'); return }
    const d = await api.setPoll(cardId, multi, opts)
    if (!d.error) { setPoll(d); setEditing(false) }
  }
  const removePoll = async () => { const d = await api.setPoll(cardId, false, []); setPoll(d); setEditing(false) }
  const vote = async (optId) => {
    if (!poll) return
    let ids
    if (poll.multi) {
      const cur = new Set(poll.options.filter(o => o.voted).map(o => o.id))
      cur.has(optId) ? cur.delete(optId) : cur.add(optId)
      ids = [...cur]
    } else ids = [optId]
    const d = await api.votePoll(cardId, ids)
    if (!d.error) setPoll(d)
  }

  const total = poll && poll.options ? poll.options.reduce((s, o) => s + o.votes, 0) : 0

  if (editing) {
    return (
      <div className="poll-edit">
        <div className="poll-mode">
          <label className={'poll-mode-btn' + (!multi ? ' on' : '')}><input type="radio" checked={!multi} onChange={() => setMulti(false)} /> Один выбор</label>
          <label className={'poll-mode-btn' + (multi ? ' on' : '')}><input type="radio" checked={multi} onChange={() => setMulti(true)} /> Несколько</label>
        </div>
        {options.map((o, i) => (
          <div className="poll-opt-edit" key={i}>
            <input className="modal-input" placeholder={'Вариант ' + (i + 1)} value={o}
              onChange={(e) => setOptions(options.map((x, j) => j === i ? e.target.value : x))} />
            {options.length > 2 && <button className="poll-opt-del" onClick={() => setOptions(options.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        <button className="poll-add-opt" onClick={() => setOptions([...options, ''])}>+ Вариант</button>
        <div className="poll-edit-actions">
          {poll && poll.is_poll && <button className="btn-danger sm" onClick={removePoll}>Убрать опрос</button>}
          <div style={{ flex: 1 }}></div>
          <button className="btn-ghost" onClick={() => setEditing(false)}>Отмена</button>
          <button className="btn-primary sm" onClick={save}>Сохранить опрос</button>
        </div>
      </div>
    )
  }

  if (!poll || !poll.is_poll) {
    return canEdit ? <button className="poll-create-btn" onClick={startEdit}>+ Сделать опросом</button> : null
  }

  return (
    <div className="poll-view">
      <div className="poll-meta">{poll.multi ? 'Несколько вариантов' : 'Один выбор'} · {poll.total_voters} голос(ов)</div>
      {poll.options.map(o => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0
        return (
          <button key={o.id} className={'poll-opt' + (o.voted ? ' voted' : '')} onClick={() => vote(o.id)}>
            <span className="poll-opt-bar" style={{ width: pct + '%' }}></span>
            <span className="poll-opt-text">{o.voted ? '✓ ' : ''}{o.text}</span>
            <span className="poll-opt-pct">{pct}% ({o.votes})</span>
          </button>
        )
      })}
      {canEdit && <button className="poll-edit-link" onClick={startEdit}>Изменить опрос</button>}
    </div>
  )
}
