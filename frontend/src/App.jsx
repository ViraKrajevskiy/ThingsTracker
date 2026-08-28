import React, { useEffect, useState, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { api, WS_URL, setToken } from './api.js'
import CardModal from './components/CardModal.jsx'
import BoardModal from './components/BoardModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import JoinScreen from './components/JoinScreen.jsx'
import Notifications from './components/Notifications.jsx'
import UpdateButton from './components/UpdateButton.jsx'
import InviteModal from './components/InviteModal.jsx'
import Card from './components/Card.jsx'
import SwimlanesView from './components/SwimlanesView.jsx'
import { IconMenu, IconChevronLeft, IconGear, IconPalette, IconLink } from './components/Icons.jsx'

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const [boards, setBoards] = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null)
  const [board, setBoard] = useState(null)
  const [members, setMembers] = useState([])
  const [statuses, setStatuses] = useState([])
  const [settings, setSettings] = useState({})
  const [openCard, setOpenCard] = useState(null)
  const [connected, setConnected] = useState(false)

  const [addingCardIn, setAddingCardIn] = useState(null)
  const [cardText, setCardText] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [listText, setListText] = useState('')
  const [boardModal, setBoardModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [expandedLists, setExpandedLists] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('tt_expanded') || '[]')) } catch { return new Set() }
  })
  const toggleExpand = (id) => setExpandedLists((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id)
    try { localStorage.setItem('tt_expanded', JSON.stringify([...n])) } catch {}
    return n
  })
  const [renamingList, setRenamingList] = useState(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDelList, setConfirmDelList] = useState(null)
  const [boardMenuId, setBoardMenuId] = useState(null)
  const [renamingBoardId, setRenamingBoardId] = useState(null)
  const [renameBoardText, setRenameBoardText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeRef = useRef(null)
  useEffect(() => { activeRef.current = activeBoardId }, [activeBoardId])

  const loadBoard = useCallback(async (id) => {
    if (!id) return
    const b = await api.board(id)
    if (!b.error) setBoard(b)
  }, [])
  const reloadTimer = useRef(null)
  const reloadBoard = useCallback(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => loadBoard(activeRef.current), 60)
  }, [loadBoard])
  const refreshBoards = useCallback(async () => setBoards(await api.boards()), [])
  const loadStatuses = useCallback(async () => setStatuses(await api.statuses()), [])

  const loadAll = useCallback(async () => {
    const bs = await api.boards()
    setBoards(bs)
    setMembers(await api.members())
    setStatuses(await api.statuses())
    setSettings(await api.settings())
    if (bs.length) setActiveBoardId(bs[0].id)
  }, [])

  // ── auth bootstrap ──
  useEffect(() => {
    (async () => {
      const hasJoin = new URLSearchParams(window.location.search).get('join')
      let me = await api.me()
      // auto-login owner on their own machine, but NOT when opening a join link
      if ((!me || me.error) && !hasJoin) {
        const bs = await api.bootstrap()
        if (bs && !bs.error) { setToken(bs.token); me = bs.user }
      }
      if (me && !me.error) { setCurrentUser(me); await loadAll() }
      setAuthReady(true)
    })()
  }, [loadAll])

  const onAuthed = async (user) => { setCurrentUser(user); await loadAll() }
  const logout = async () => {
    await api.logout(); setToken(null)
    setCurrentUser(null); setBoards([]); setBoard(null); setActiveBoardId(null)
  }
  const switchUser = () => {
    setToken(null); setShowLogin(true)
    setCurrentUser(null); setBoards([]); setBoard(null); setActiveBoardId(null)
  }

  useEffect(() => { if (currentUser) loadBoard(activeBoardId) }, [activeBoardId, loadBoard, currentUser])

  useEffect(() => {
    if (!currentUser) return
    let ws, retry, closed = false
    const connect = () => {
      ws = new WebSocket(WS_URL)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => { if (closed) return; setConnected(false); retry = setTimeout(connect, 2000) }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          const boardEvents = ['card_created','card_updated','card_moved','card_deleted',
            'list_created','list_updated','list_moved','list_deleted','comment_added','comment_deleted',
            'attachment_added','attachment_deleted']
          if (boardEvents.includes(msg.type)) reloadBoard()
          else if (msg.type === 'board_updated') { reloadBoard(); refreshBoards() }
          else if (msg.type === 'board_created') refreshBoards()
          else if (msg.type === 'statuses_updated') { loadStatuses(); reloadBoard() }
        } catch {}
      }
    }
    connect()
    return () => { closed = true; clearTimeout(retry); if (ws) { ws.onclose = null; ws.close() } }
  }, [currentUser, loadBoard, reloadBoard, refreshBoards, loadStatuses])

  const myRole = board?.my_role || null
  const isBoardAdmin = myRole === 'admin'
  const perms = board?.my_perms || {}
  const canCreate = isBoardAdmin || !!perms.create_cards
  const canEdit = isBoardAdmin || !!perms.edit_cards
  const canMove = isBoardAdmin || !!perms.move_cards
  const canDelete = isBoardAdmin || !!perms.delete_cards
  const canDeadline = isBoardAdmin || !!perms.set_deadline
  const canColumns = isBoardAdmin || !!perms.manage_columns
  const canSwimlanes = isBoardAdmin || !!perms.manage_swimlanes
  const canMembers = isBoardAdmin || !!perms.manage_members
  const canComment = isBoardAdmin || !!perms.comment
  const readOnly = !canCreate && !canEdit && !canMove && !canDelete && !canColumns

  const onDragEnd = async (result) => {
    const { source, destination, draggableId, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    if (type === 'list') {
      if (!canColumns) return
      setBoard((prev) => {
        const next = structuredClone(prev)
        const [moved] = next.lists.splice(source.index, 1)
        next.lists.splice(destination.index, 0, moved)
        return next
      })
      await api.moveList(draggableId, destination.index)
      return
    }
    if (!canMove) return
    const parseId = (id) => {
      if (id.startsWith('sl__')) {
        const parts = id.split('__')
        return { listId: parts[1], swimlaneId: parts[2] === 'none' ? null : parts[2] }
      }
      return { listId: id, swimlaneId: undefined }
    }
    const src = parseId(source.droppableId)
    const dst = parseId(destination.droppableId)
    setBoard((prev) => {
      const next = structuredClone(prev)
      const srcList = next.lists.find(l => l.id === src.listId)
      const dstList = next.lists.find(l => l.id === dst.listId)
      if (!srcList || !dstList) return prev
      const idx = srcList.cards.findIndex(c => c.id === draggableId)
      if (idx < 0) return prev
      const [moved] = srcList.cards.splice(idx, 1)
      moved.list_id = dstList.id
      if (dst.swimlaneId !== undefined) moved.swimlane_id = dst.swimlaneId
      dstList.cards.splice(destination.index, 0, moved)
      return next
    })
    await api.moveCard(draggableId, dst.listId, destination.index, dst.swimlaneId)
  }

  const submitCard = async (listId) => {
    const t = cardText.trim()
    if (!t) { setAddingCardIn(null); return }
    await api.createCard(listId, t)
    setCardText(''); setAddingCardIn(null); reloadBoard()
  }
  const submitList = async () => {
    const t = listText.trim()
    if (!t) { setAddingList(false); return }
    await api.createList(activeBoardId, t)
    setListText(''); setAddingList(false); reloadBoard()
  }
  const submitRename = async (listId) => {
    const t = renameText.trim()
    if (t) await api.updateList(listId, t)
    setRenamingList(null); reloadBoard()
  }
  const doDeleteList = async (listId) => {
    await api.deleteList(listId); setConfirmDelList(null); reloadBoard()
  }
  const copyInvite = async () => {
    const n = await api.netInfo()
    const ip = (n && !n.error) ? n.ip : window.location.hostname
    const port = (n && !n.error) ? n.port : (window.location.port || '8766')
    const tailscaleIp = (n && !n.error) ? (n.tailscale_ip || null) : null
    setInviteLink({ ip, port, tailscaleIp, boardId: activeBoardId })
  }

  const deleteBoard = async (id) => {
    const target = id || activeBoardId
    await api.deleteBoard(target)
    setBoardModal(null); setBoardMenuId(null)
    const bs = await api.boards(); setBoards(bs)
    if (target === activeBoardId) { setActiveBoardId(bs.length ? bs[0].id : null); setBoard(null) }
  }
  const submitBoardRename = async (id) => {
    const t = renameBoardText.trim()
    if (t) { await api.updateBoard(id, { name: t }); await refreshBoards(); if (id === activeBoardId) loadBoard(activeBoardId) }
    setRenamingBoardId(null)
  }

  const submitBoardModal = async ({ name, board_type, color, roles_enabled, require_approval, accept_members }) => {
    if (boardModal === 'create') {
      const ws = await api.workspaces()
      const b = await api.createBoard(ws[0].id, name, board_type, color)
      await refreshBoards(); setActiveBoardId(b.id)
    } else {
      await api.updateBoard(activeBoardId, { name, color, roles_enabled, require_approval, accept_members })
      await loadBoard(activeBoardId); await refreshBoards()
    }
    setBoardModal(null)
  }

  const joinId = new URLSearchParams(window.location.search).get('join')
  const afterJoin = async () => { const me = await api.me(); if (me && !me.error) { setCurrentUser(me); await loadAll() } }
  if (!authReady) return <div className="app"><div className="empty">Загрузка…</div></div>
  if (!currentUser) {
    if (joinId && !showLogin) return <JoinScreen boardId={joinId} onJoined={afterJoin} onFallback={() => setShowLogin(true)} />
    return <AuthScreen onAuthed={onAuthed} />
  }

  const accent = board?.color || '#00D4FF'

  return (
    <div className="app">
      <aside className={'sidebar' + (sidebarOpen ? '' : ' collapsed')}>
        <div className="brand">
          <div className="brand-mark"><span></span><span></span><span></span><span></span></div>
          <span className="brand-name">ThingTracker</span>
          <button className="sidebar-toggle" title="Скрыть панель" onClick={() => setSidebarOpen(false)}><IconChevronLeft size={16} /></button>
        </div>
        <div className="side-label">Доски</div>
        <nav className="board-nav">
          {boards.map(b => (
            <div key={b.id} className={'board-nav-item' + (b.id === activeBoardId ? ' active' : '')}
              style={{ '--nav-accent': b.color || '#00D4FF' }}>
              <span className="nav-dot" style={{ background: b.color || '#00D4FF' }}></span>
              {renamingBoardId === b.id ? (
                <input className="inline-input board-rename" autoFocus value={renameBoardText}
                  onChange={(e) => setRenameBoardText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitBoardRename(b.id); if (e.key === 'Escape') setRenamingBoardId(null) }}
                  onBlur={() => submitBoardRename(b.id)} />
              ) : (
                <span className="board-nav-name" onClick={() => setActiveBoardId(b.id)}
                  onDoubleClick={() => { setRenamingBoardId(b.id); setRenameBoardText(b.name) }}>{b.name}</span>
              )}
              <button className="board-menu-btn" onClick={(e) => { e.stopPropagation(); setBoardMenuId(boardMenuId === b.id ? null : b.id) }}>⋯</button>
              {boardMenuId === b.id && (
                <div className="board-menu" onMouseLeave={() => setBoardMenuId(null)}>
                  <button onClick={() => { setRenamingBoardId(b.id); setRenameBoardText(b.name); setBoardMenuId(null) }}>Переименовать</button>
                  <button onClick={() => { setActiveBoardId(b.id); setBoardModal('edit'); setBoardMenuId(null) }}>Дизайн</button>
                  <button className="danger" onClick={() => { if (confirm('Удалить доску «' + b.name + '»?')) deleteBoard(b.id) }}>Удалить</button>
                </div>
              )}
            </div>
          ))}
          <button className="board-nav-add" onClick={async () => { setSettings(await api.settings()); setBoardModal('create') }}>+ Новая доска</button>
        </nav>
        <div className="side-footer">
          <UpdateButton />
          <button className="settings-link" onClick={() => setShowSettings(true)}><IconGear size={15} /> Настройки</button>
          <div className="presence">
            <span className={'dot ' + (connected ? 'on' : 'off')}></span>
            {connected ? 'Синхронизировано' : 'Офлайн'}
          </div>
          <div className="user-row">
            <div className="avatar" style={{ background: currentUser.color }}>{currentUser.display_name[0]}</div>
            <div className="user-meta">
              <div className="user-name">{currentUser.display_name}</div>
              <div className="user-role">{currentUser.global_role === 'owner' ? 'владелец' : 'пользователь'}</div>
            </div>
            <button className="logout-btn" title="Выйти" onClick={logout}>Выйти</button>
          </div>
          <button className="switch-user-btn" onClick={switchUser}>Войти под другим аккаунтом</button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="sidebar-reopen" title="Показать панель" onClick={() => setSidebarOpen(true)}><IconMenu size={18} /></button>
      )}
      <main className={'board-area' + (sidebarOpen ? '' : ' no-sidebar')} style={{ '--accent': accent }}>
        {board ? (
          <>
            <header className="board-header">
              <h1>{board.name}{readOnly ? <span className="ro-badge">только просмотр</span> : null}</h1>
              <div className="header-actions">
                <Notifications onChanged={() => { refreshBoards(); loadBoard(activeBoardId) }} />
                {isBoardAdmin && <button className="btn-icon" title="Пригласить (ссылка)" onClick={copyInvite}><IconLink size={17} /></button>}
                {isBoardAdmin && <button className="btn-icon" title="Дизайн доски" onClick={() => setBoardModal('edit')}><IconPalette size={17} /></button>}
                <button className="btn-icon" title="Настройки и статусы" onClick={() => setShowSettings(true)}><IconGear size={17} /></button>
                {canColumns && (addingList ? (
                  <input className="inline-input header-input" autoFocus value={listText}
                    placeholder="Название списка"
                    onChange={(e) => setListText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitList(); if (e.key === 'Escape') setAddingList(false) }}
                    onBlur={submitList} />
                ) : (
                  <button className="btn-ghost" onClick={() => setAddingList(true)}>+ Список</button>
                ))}
              </div>
            </header>

            <DragDropContext onDragEnd={onDragEnd}>
              {board.swimlane_mode && board.swimlane_mode !== 'off' ? (
                <SwimlanesView board={board} members={members} statuses={statuses} accent={accent}
                  canEdit={canEdit} canMove={canMove} canDelete={canDelete} canCreate={canCreate} canSwimlanes={canSwimlanes}
                  onOpenCard={setOpenCard} onReload={reloadBoard}
                  onAddCard={async (listId, title, swimlaneId) => { const r = await api.createCard(listId, title); if (r && r.id && swimlaneId) await api.updateCard(r.id, { swimlane_id: swimlaneId }); reloadBoard() }}
                  api={api} />
              ) : (
              <Droppable droppableId="board" direction="horizontal" type="list">
                {(bp) => (
                  <div className="lists" ref={bp.innerRef} {...bp.droppableProps}>
                    {board.lists.map((list, li) => (
                      <Draggable draggableId={list.id} index={li} key={list.id} isDragDisabled={!canColumns}>
                        {(lp) => (
                          <div className={'list' + (expandedLists.has(list.id) ? ' expanded' : '')} ref={lp.innerRef} {...lp.draggableProps}>
                            <div className="list-head" {...lp.dragHandleProps}>
                              <span className="list-accent" style={{ background: accent }}></span>
                              {renamingList === list.id ? (
                                <input className="inline-input list-rename" autoFocus value={renameText}
                                  onChange={(e) => setRenameText(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(list.id); if (e.key === 'Escape') setRenamingList(null) }}
                                  onBlur={() => submitRename(list.id)} />
                              ) : (
                                <span className="list-name"
                                  onDoubleClick={() => { if (canColumns) { setRenamingList(list.id); setRenameText(list.name) } }}
                                  title={canColumns ? 'Двойной клик — переименовать' : ''}>{list.name}</span>
                              )}
                              <span className="list-count">{list.cards.length}</span>
                              <button className="list-expand" title={expandedLists.has(list.id) ? 'Свернуть' : 'Развернуть колонку'} onClick={(e) => { e.stopPropagation(); toggleExpand(list.id) }}>{expandedLists.has(list.id) ? '▾' : '▸'}</button>
                              {canColumns && (confirmDelList === list.id ? (
                                <span className="list-confirm">
                                  <button className="lc-yes" onClick={() => doDeleteList(list.id)}>Удалить</button>
                                  <button className="lc-no" onClick={() => setConfirmDelList(null)}>×</button>
                                </span>
                              ) : (
                                <button className="list-del" title="Удалить колонку" onClick={() => setConfirmDelList(list.id)}>×</button>
                              ))}
                            </div>
                            <Droppable droppableId={list.id} type="card">
                              {(cp, snap) => (
                                <div className={'list-cards' + (snap.isDraggingOver ? ' over' : '')}
                                  ref={cp.innerRef} {...cp.droppableProps}>
                                  {list.cards.map((card, i) => (
                                    <Draggable key={card.id} draggableId={card.id} index={i} isDragDisabled={!canMove}>
                                      {(prov) => (
                                        <Card card={card} members={members} statuses={statuses} canEdit={canEdit} canMove={canMove} canDelete={canDelete}
                                          dragProps={prov} onOpen={setOpenCard}
                                          onChanged={() => reloadBoard()} />
                                      )}
                                    </Draggable>
                                  ))}
                                  {cp.placeholder}
                                  {canCreate && (addingCardIn === list.id ? (
                                    <textarea className="inline-input card-input" autoFocus value={cardText}
                                      placeholder="Что нужно сделать?"
                                      onChange={(e) => setCardText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCard(list.id) }
                                        if (e.key === 'Escape') { setAddingCardIn(null); setCardText('') }
                                      }}
                                      onBlur={() => submitCard(list.id)} />
                                  ) : (
                                    <button className="card-add" onClick={() => { setAddingCardIn(list.id); setCardText('') }}>+ Задача</button>
                                  ))}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {bp.placeholder}
                    {board.lists.length === 0 && (
                      <div className="empty-board">В этой доске пока нет колонок.{canColumns ? ' Нажми «+ Список».' : ''}</div>
                    )}
                  </div>
                )}
              </Droppable>
              )}
            </DragDropContext>
          </>
        ) : (<div className="empty">Загрузка…</div>)}
      </main>

      {openCard && (
        <CardModal card={openCard} members={members} statuses={statuses} canEdit={canEdit} canMove={canMove} canDelete={canDelete} canDeadline={canDeadline} canComment={canComment}
          onClose={() => setOpenCard(null)}
          onSaved={() => { setOpenCard(null); loadBoard(activeBoardId) }} />
      )}
      {boardModal && (
        <BoardModal mode={boardModal} board={boardModal === 'edit' ? board : null}
          defaults={{ board_type: settings.default_board_type, color: settings.default_color }}
          onClose={() => setBoardModal(null)} onSubmit={submitBoardModal}
          onDelete={boardModal === 'edit' ? deleteBoard : null} />
      )}
      {inviteLink && (
        <InviteModal net={inviteLink} boardName={board?.name} onClose={() => setInviteLink(null)} />
      )}
      {showSettings && (
        <SettingsModal currentUser={currentUser} activeBoard={board}
          onClose={() => setShowSettings(false)}
          onChanged={async () => { loadStatuses(); loadBoard(activeBoardId); setSettings(await api.settings()) }} />
      )}
    </div>
  )
}
