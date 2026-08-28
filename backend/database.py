"""SQLite storage layer for ThingTracker."""
import sqlite3
import os
import json
import time
import uuid
from contextlib import contextmanager

DB_PATH = os.environ.get("TT_DB_PATH", os.path.join(os.path.dirname(__file__), "thingtracker.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    board_type TEXT NOT NULL DEFAULT 'kanban',
    color TEXT NOT NULL DEFAULT '#00D4FF',
    created_at REAL NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    labels TEXT DEFAULT '[]',
    due_date REAL,
    assignee TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    color TEXT DEFAULT '#00D4FF'
);

CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7A97C8',
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    author TEXT,
    text TEXT NOT NULL,
    created_at REAL NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    color TEXT DEFAULT '#35D0F0',
    global_role TEXT NOT NULL DEFAULT 'user',
    activated INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS board_members (
    board_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (board_id, user_id),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS board_join_requests (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at REAL NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    read INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_options (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    text TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    stored_name TEXT NOT NULL,
    created_at REAL NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS swimlanes (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7A97C8',
  position INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA temp_store = MEMORY")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now():
    return time.time()


def new_id():
    return uuid.uuid4().hex


def _migrate(conn):
    """Add new columns to databases created by older versions."""
    alters = [
        "ALTER TABLE boards ADD COLUMN board_type TEXT NOT NULL DEFAULT 'kanban'",
        "ALTER TABLE boards ADD COLUMN color TEXT NOT NULL DEFAULT '#00D4FF'",
        "ALTER TABLE cards ADD COLUMN status TEXT DEFAULT 'open'",
    ]
    for sql in alters:
        try:
            conn.execute(sql)
        except Exception:
            pass  # column already exists
    for sql in [
        "ALTER TABLE board_members ADD COLUMN permissions TEXT DEFAULT '{}'",
        "ALTER TABLE lists ADD COLUMN expanded INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE cards ADD COLUMN poll_multi INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE boards ADD COLUMN roles_enabled INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE boards ADD COLUMN require_approval INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE boards ADD COLUMN accept_members INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE cards ADD COLUMN swimlane_id TEXT",
        "ALTER TABLE boards ADD COLUMN swimlane_mode TEXT NOT NULL DEFAULT 'off'",
        "ALTER TABLE boards ADD COLUMN swimlane_field TEXT",
    ]:
        try:
            conn.execute(sql)
        except Exception:
            pass
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id)",
        "CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id)",
        "CREATE INDEX IF NOT EXISTS idx_attachments_card ON attachments(card_id)",
        "CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id)",
        "CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members(board_id)",
        "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)",
        "CREATE INDEX IF NOT EXISTS idx_join_board ON board_join_requests(board_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_poll_options_card ON poll_options(card_id)",
        "CREATE INDEX IF NOT EXISTS idx_poll_votes_card ON poll_votes(card_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_vote_uniq ON poll_votes(option_id, user_id)",
        "CREATE INDEX IF NOT EXISTS idx_swimlanes_board ON swimlanes(board_id)",
        "CREATE INDEX IF NOT EXISTS idx_cards_swimlane ON cards(swimlane_id)",
    ]
    for sql in indexes:
        try:
            conn.execute(sql)
        except Exception:
            pass


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM workspaces").fetchone()
        if row["c"] == 0:
            ws_id = new_id()
            conn.execute(
                "INSERT INTO workspaces (id, name, created_at) VALUES (?,?,?)",
                (ws_id, "Мой проект", now()),
            )
            board_id = new_id()
            conn.execute(
                "INSERT INTO boards (id, workspace_id, name, position, created_at) VALUES (?,?,?,?,?)",
                (board_id, ws_id, "Первая доска", 0, now()),
            )
            for i, ln in enumerate(["Бэклог", "В работе", "Готово"]):
                conn.execute(
                    "INSERT INTO lists (id, board_id, name, position) VALUES (?,?,?,?)",
                    (new_id(), board_id, ln, i),
                )
            conn.execute(
                "INSERT INTO members (id, name, role, color) VALUES (?,?,?,?)",
                (new_id(), "Vira", "owner", "#00D4FF"),
            )
    # seed default statuses (global, editable) if none exist
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) AS c FROM statuses").fetchone()["c"] == 0:
            defaults = [
                ("open", "Открыта", "#7A97C8"),
                ("active", "В работе", "#00D4FF"),
                ("review", "На проверке", "#FFB347"),
                ("done", "Готово", "#00E5A0"),
                ("blocked", "Заблокирована", "#FF6B9D"),
            ]
            for i, (sid, label, color) in enumerate(defaults):
                conn.execute(
                    "INSERT INTO statuses (id, label, color, position) VALUES (?,?,?,?)",
                    (sid, label, color, i),
                )
    # seed default settings
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) AS c FROM settings").fetchone()["c"] == 0:
            for k, v in [("default_board_type", "kanban"), ("default_color", "#00D4FF")]:
                conn.execute("INSERT INTO settings (key, value) VALUES (?,?)", (k, v))
    # seed default owner user (login: admin / admin1234) + make owner of all boards
    import auth as _auth
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"] == 0:
            uid = new_id()
            conn.execute(
                "INSERT INTO users (id, username, password_hash, display_name, color, global_role, activated, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (uid, "admin", _auth.hash_password("admin1234"), "Vira", "#35D0F0", "owner", 1, now()),
            )
            for b in conn.execute("SELECT id FROM boards").fetchall():
                conn.execute("INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?,?,?)",
                             (b["id"], uid, "admin"))


def dict_from_row(row):
    d = dict(row)
    if "labels" in d and isinstance(d["labels"], str):
        try:
            d["labels"] = json.loads(d["labels"])
        except Exception:
            d["labels"] = []
    return d
