import React, { useState } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import Card from './Card.jsx'

// Renders lists as columns and swimlanes as horizontal rows.
// Each (list, swimlane) intersection is its own droppable id: `${listId}__${swimlaneId||'none'}`
// Card add lives in the "no swimlane" or first row for simplicity.
export default function SwimlanesView({
  board, members, statuses, accent, canEdit, canMove, canDelete, canCreate, canSwimlanes,
  onOpenCard, onReload, onAddCard, api,
}) {
  const [addingIn, setAddingIn] = useState(null) // {listId, swimlaneId}
  const [text, setText] = useState('')
  const [newSwimlaneName, setNewSwimlaneName] = useState('')
  const [addingSwimlane, setAddingSwimlane] = useState(false)

  const lists = board.lists || []
  const swimlanes = board.swimlanes || []

  // Build map (list_id -> swimlane_id -> [cards])
  const cellCards = {}
  for (const l of lists) {
    cellCards[l.id] = { none: [] }
    for (const s of swimlanes) cellCards[l.id][s.id] = []
  }
  for (const l of lists) {
    for (const c of (l.cards || [])) {
      const sid = c.swimlane_id || 'none'
      if (!cellCards[l.id][sid]) cellCards[l.id][sid] = []
      cellCards[l.id][sid].push(c)
    }
  }

  const rows = [...swimlanes.map(s => ({ id: s.id, name: s.name, color: s.color, sw: s })), { id: 'none', name: 'Без строки', color: '#4a5468', sw: null }]

  const submit = async (listId, swimlaneId) => {
    const t = text.trim()
    if (!t) { setAddingIn(null); return }
    await onAddCard(listId, t, swimlaneId === 'none' ? null : swimlaneId)
    setText(''); setAddingIn(null)
  }

  const addSwim = async () => {
    const n = newSwimlaneName.trim()
    if (!n) { setAddingSwimlane(false); return }
    await api.createSwimlane(board.id, n, '#7A97C8')
    setNewSwimlaneName(''); setAddingSwimlane(false); onReload()
  }
  const renameSwim = async (s) => {
    const n = window.prompt('Название строки', s.name)
    if (n && n.trim() !== s.name) { await api.updateSwimlane(s.id, { name: n.trim() }); onReload() }
  }
  const delSwim = async (s) => {
    if (!window.confirm(`Удалить строку «${s.name}»? Карточки останутся, но перейдут в «Без строки».`)) return
    await api.deleteSwimlane(s.id); onReload()
  }

  return (
    <div className="sl-grid" style={{ '--cols': lists.length }}>
      {/* Header row: column names */}
      <div className="sl-header-row">
        <div className="sl-corner"></div>
        {lists.map(l => (
          <div key={l.id} className="sl-col-head">
            <span className="list-accent" style={{ background: accent }}></span>
            <span className="list-name">{l.name}</span>
            <span className="list-count">{(l.cards || []).length}</span>
          </div>
        ))}
      </div>

      {rows.map(row => (
        <div key={row.id} className="sl-row">
          <div className="sl-row-label" style={{ borderLeftColor: row.color }}>
            <div className="sl-row-name">{row.name}</div>
            {canSwimlanes && row.sw && (
              <div className="sl-row-actions">
                <button title="Переименовать" onClick={() => renameSwim(row.sw)}>✎</button>
                <button title="Удалить строку" onClick={() => delSwim(row.sw)}>×</button>
              </div>
            )}
          </div>
          {lists.map(l => {
            const droppableId = `sl__${l.id}__${row.id}`
            const cards = cellCards[l.id]?.[row.id] || []
            return (
              <Droppable key={droppableId} droppableId={droppableId} type="card">
                {(cp, snap) => (
                  <div className={'sl-cell' + (snap.isDraggingOver ? ' over' : '')} ref={cp.innerRef} {...cp.droppableProps}>
                    {cards.map((card, i) => (
                      <Draggable key={card.id} draggableId={card.id} index={i} isDragDisabled={!canMove}>
                        {(prov) => (
                          <Card card={card} members={members} statuses={statuses}
                            canEdit={canEdit} canMove={canMove} canDelete={canDelete}
                            dragProps={prov} onOpen={onOpenCard} onChanged={onReload} />
                        )}
                      </Draggable>
                    ))}
                    {cp.placeholder}
                    {canCreate && (addingIn?.listId === l.id && addingIn?.swimlaneId === row.id ? (
                      <textarea className="inline-input card-input" autoFocus value={text}
                        placeholder="Что нужно сделать?"
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(l.id, row.id) }
                          if (e.key === 'Escape') { setAddingIn(null); setText('') }
                        }}
                        onBlur={() => submit(l.id, row.id)} />
                    ) : (
                      <button className="card-add sl-add" onClick={() => { setAddingIn({ listId: l.id, swimlaneId: row.id }); setText('') }}>+ Задача</button>
                    ))}
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      ))}

      {canSwimlanes && (
        <div className="sl-add-row">
          {addingSwimlane ? (
            <input className="inline-input" autoFocus value={newSwimlaneName}
              placeholder="Название новой строки"
              onChange={(e) => setNewSwimlaneName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSwim(); if (e.key === 'Escape') setAddingSwimlane(false) }}
              onBlur={addSwim} />
          ) : (
            <button className="btn-ghost" onClick={() => setAddingSwimlane(true)}>+ Добавить строку (свимлейн)</button>
          )}
        </div>
      )}
    </div>
  )
}
