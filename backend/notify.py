"""In-app notifications."""
import json
import database as db


def push(user_id: str, ntype: str, text: str, data: dict = None):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO notifications (id, user_id, type, text, data, read, created_at) VALUES (?,?,?,?,?,0,?)",
            (db.new_id(), user_id, ntype, text, json.dumps(data or {}), db.now()),
        )


def board_admin_ids(board_id: str):
    """User ids who administer a board: board admins + global owners."""
    ids = set()
    with db.get_conn() as conn:
        for r in conn.execute("SELECT user_id FROM board_members WHERE board_id=? AND role='admin'", (board_id,)).fetchall():
            ids.add(r["user_id"])
        for r in conn.execute("SELECT id FROM users WHERE global_role='owner'").fetchall():
            ids.add(r["id"])
    return ids


def notify_board_admins(board_id: str, ntype: str, text: str, data: dict = None, exclude: str = None):
    for uid in board_admin_ids(board_id):
        if uid != exclude:
            push(uid, ntype, text, data)
