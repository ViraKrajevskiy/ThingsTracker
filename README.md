# ThingTracker

Кросс-платформенный трекер задач (Trello + YouTrack) с P2P-синхронизацией.
Стек: **React (Vite) + Python (FastAPI)**, десктоп через **Electron**, мобильные через **PWA**.
Работает на Windows / macOS / Linux. Центральный сервер не нужен — устройства
находят друг друга в локальной сети через mDNS и синхронизируются по WebSocket.

## Структура

```
ThingTracker/
├── backend/          # Python FastAPI: REST + WebSocket + mDNS + SQLite
│   ├── main.py
│   ├── database.py
│   └── requirements.txt
├── frontend/         # React + Vite: доски, карточки, drag-and-drop
│   └── src/
├── electron/         # Десктоп-оболочка (запускает backend + окно)
│   └── main.js
└── package.json      # корневой (Electron + сборка)
```

## Запуск для разработки

Нужны: Node.js 18+ и Python 3.10+.

**1. Backend (Python):**
```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python main.py          # поднимется на http://localhost:8766
```

**2. Frontend (React):**
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

**3. Десктоп (Electron) — в отдельном терминале из корня:**
```bash
npm install
npm run dev:electron
```

Или всё сразу (frontend + electron), backend запусти отдельно:
```bash
npm install
npm run dev
```

## Мобильные устройства (PWA)

Телефон должен быть в той же Wi-Fi сети, что и десктоп.
1. Собери фронт: `cd frontend && npm run build` — backend сам начнёт его отдавать.
2. Узнай IP десктопа (в логах backend: `[mDNS] Announced ... on 192.168.x.x`).
3. На телефоне открой `http://<IP-десктопа>:8766` в браузере → «Добавить на главный экран».

## Сборка инсталляторов

```bash
npm run dist     # соберёт .exe / .dmg / .AppImage под текущую ОС
```
(Backend упаковывается в бинарник через PyInstaller, фронт — в статику,
всё оборачивается electron-builder.)

## Роли

Owner · Admin · Member · Viewer — хранятся в таблице `members`.
Проверка прав на действиях будет добавлена в Фазе 2 вместе с P2P.

## Дорожная карта

- [x] **Фаза 1 — Фундамент**: доски, списки, карточки, drag-and-drop, SQLite, Electron
- [ ] **Фаза 2 — P2P сеть**: mDNS-обнаружение пиров, синхронизация между устройствами, CRDT, права ролей
- [ ] **Фаза 3 — Mobile PWA**: Service Worker, офлайн, QR-подключение
- [ ] **Фаза 4 — Трекер**: спринты, backlog, Gantt, аналитика
