// API client with auth token.
const params = new URLSearchParams(window.location.search)
const HOST = params.get('host') || window.location.hostname || 'localhost'
const PORT = params.get('ttport') || window.location.port || '8766'
export const BASE = `http://${HOST}:${PORT}`
export const WS_URL = `ws://${HOST}:${PORT}/ws`

let _token = null
try { _token = localStorage.getItem('tt_token') } catch {}
export function setToken(t) { _token = t; try { t ? localStorage.setItem('tt_token', t) : localStorage.removeItem('tt_token') } catch {} }
export function getToken() { return _token }

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (_token) headers['Authorization'] = 'Bearer ' + _token
  const res = await fetch(BASE + path, { ...opts, headers })
  let data = null
  try { data = await res.json() } catch {}
  if (!res.ok) return { error: (data && data.detail) || res.status, status: res.status }
  return data
}

export const api = {
  // auth
  register: (username, password, display_name) =>
    req('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, display_name }) }),
  login: (username, password) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req('/api/auth/me'),
  bootstrap: () => req('/api/auth/bootstrap'),
  logout: () => req('/api/auth/logout', { method: 'POST' }),

  // join flow
  netInfo: () => req('/api/net-info'),
  boardPublic: (id) => req(`/api/boards/${id}/public`),
  myAccess: (id) => req(`/api/boards/${id}/my-access`),
  requestJoin: (id) => req(`/api/boards/${id}/join-request`, { method: 'POST' }),
  joinRequests: () => req('/api/join-requests'),
  approveJoin: (rid, role) => req(`/api/join-requests/${rid}/approve`, { method: 'POST', body: JSON.stringify({ role }) }),
  denyJoin: (rid) => req(`/api/join-requests/${rid}/deny`, { method: 'POST' }),

  // notifications
  notifications: () => req('/api/notifications'),
  notifCount: () => req('/api/notifications/count'),
  notifRead: (id) => req(`/api/notifications/${id}/read`, { method: 'POST' }),
  notifReadAll: () => req('/api/notifications/read-all', { method: 'POST' }),

  // users (admin)
  users: () => req('/api/users'),
  createUser: (data) => req('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => req(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id) => req(`/api/users/${id}`, { method: 'DELETE' }),

  // board members
  boardMembers: (boardId) => req(`/api/boards/${boardId}/members`),
  addBoardMember: (boardId, user_id, role) =>
    req(`/api/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ user_id, role }) }),
  removeBoardMember: (boardId, userId) =>
    req(`/api/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),

  // boards / lists / cards
  boards: () => req('/api/boards'),
  board: (id) => req(`/api/boards/${id}`),
  members: () => req('/api/members'),
  createBoard: (workspace_id, name, board_type = 'kanban', color = '#00D4FF') =>
    req('/api/boards', { method: 'POST', body: JSON.stringify({ workspace_id, name, board_type, color }) }),
  updateBoard: (id, data) => req(`/api/boards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  createList: (board_id, name) => req('/api/lists', { method: 'POST', body: JSON.stringify({ board_id, name }) }),
  updateList: (id, name) => req(`/api/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  moveList: (list_id, position) => req('/api/lists/move', { method: 'POST', body: JSON.stringify({ list_id, position }) }),
  deleteList: (id) => req(`/api/lists/${id}`, { method: 'DELETE' }),
  createCard: (list_id, title) => req('/api/cards', { method: 'POST', body: JSON.stringify({ list_id, title }) }),
  updateCard: (id, data) => req(`/api/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveCard: (card_id, list_id, position) => req('/api/cards/move', { method: 'POST', body: JSON.stringify({ card_id, list_id, position }) }),
  deleteCard: (id) => req(`/api/cards/${id}`, { method: 'DELETE' }),
  workspaces: () => req('/api/workspaces'),

  // statuses
  statuses: () => req('/api/statuses'),
  createStatus: (label, color) => req('/api/statuses', { method: 'POST', body: JSON.stringify({ label, color }) }),
  updateStatus: (id, data) => req(`/api/statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStatus: (id) => req(`/api/statuses/${id}`, { method: 'DELETE' }),

  // comments
  comments: (cardId) => req(`/api/cards/${cardId}/comments`),
  addComment: (cardId, author, text) => req(`/api/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify({ author, text }) }),
  deleteComment: (id) => req(`/api/comments/${id}`, { method: 'DELETE' }),

  // settings
  settings: () => req('/api/settings'),
  updateSettings: (data) => req('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // attachments
  attachments: (cardId) => req(`/api/cards/${cardId}/attachments`),
  uploadAttachment: async (cardId, fileObj) => {
    const fd = new FormData()
    fd.append('file', fileObj)
    const headers = {}
    if (_token) headers['Authorization'] = 'Bearer ' + _token
    const res = await fetch(`${BASE}/api/cards/${cardId}/attachments`, { method: 'POST', body: fd, headers })
    return res.json()
  },
  attachmentUrl: (id) => `${BASE}/api/attachments/${id}`,
  attachmentDownloadUrl: (id) => `${BASE}/api/attachments/${id}?download=1`,
  deleteAttachment: (id) => req(`/api/attachments/${id}`, { method: 'DELETE' }),
}
