"""Authentication + authorization helpers.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib, no extra deps).
Sessions are opaque tokens stored in the `sessions` table.
"""
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException

import database as db

_ITER = 120_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITER)
    return f"pbkdf2${_ITER}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored:
        return False
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_hex(24)


def create_session(user_id: str) -> str:
    token = new_token()
    with db.get_conn() as conn:
        conn.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                     (token, user_id, db.now()))
    return token


def drop_session(token: str):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))


def _token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return authorization.strip()


def user_by_token(token: Optional[str]):
    if not token:
        return None
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=?",
            (token,),
        ).fetchone()
        return db.dict_from_row(row) if row else None


def optional_user(authorization: Optional[str] = Header(None)):
    return user_by_token(_token_from_header(authorization))


def require_user(authorization: Optional[str] = Header(None)):
    user = user_by_token(_token_from_header(authorization))
    if not user:
        raise HTTPException(status_code=401, detail="Требуется вход")
    return user


def board_role(user: dict, board_id: str) -> Optional[str]:
    """Effective role of user on a board. Global owner is always 'admin'."""
    if not user:
        return None
    if user.get("global_role") == "owner":
        return "admin"
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT role FROM board_members WHERE board_id=? AND user_id=?",
            (board_id, user["id"]),
        ).fetchone()
        return row["role"] if row else None


import json as _json

# capability keys (order matters — used for UI columns)
PERM_KEYS = [
    "create_cards", "edit_cards", "move_cards", "delete_cards", "set_deadline",
    "manage_columns", "manage_swimlanes", "manage_members", "comment",
]


def default_perms(role: str) -> dict:
    """Sensible defaults per role (used as fallback for keys not stored yet)."""
    if role == "admin":
        return {k: True for k in PERM_KEYS}
    if role == "member":
        return {
            "create_cards": True, "edit_cards": True, "move_cards": True,
            "delete_cards": False, "set_deadline": True, "manage_columns": False,
            "manage_swimlanes": False, "manage_members": False, "comment": True,
        }
    # viewer / unknown
    return {k: False for k in PERM_KEYS}


def get_permissions(user: dict, board_id: str) -> dict:
    """Effective granular permissions of user on a board."""
    role = board_role(user, board_id)
    if role == "admin":  # board admin / global owner -> everything
        return {k: True for k in PERM_KEYS}
    if not role:
        return {k: False for k in PERM_KEYS}
    # if roles are disabled on this board, every member gets full access
    with db.get_conn() as conn:
        b = conn.execute("SELECT roles_enabled FROM boards WHERE id=?", (board_id,)).fetchone()
    if b and b["roles_enabled"] == 0:
        return {k: True for k in PERM_KEYS}
    # member/viewer -> read stored permissions json; fall back to role defaults for missing keys
    with db.get_conn() as conn:
        row = conn.execute("SELECT permissions FROM board_members WHERE board_id=? AND user_id=?",
                           (board_id, user["id"])).fetchone()
    perms = {}
    if row and row["permissions"]:
        try:
            perms = _json.loads(row["permissions"])
        except Exception:
            perms = {}
    defaults = default_perms(role)
    return {k: bool(perms[k]) if k in perms else defaults[k] for k in PERM_KEYS}


def can(user: dict, board_id: str, key: str) -> bool:
    if not user:
        return False
    return get_permissions(user, board_id).get(key, False)


def require_perm(user: dict, board_id: str, key: str):
    if not can(user, board_id, key):
        raise HTTPException(status_code=403, detail="Недостаточно прав для этого действия")


def can_write(user: dict, board_id: str) -> bool:
    p = get_permissions(user, board_id)
    return any(p.values())


def is_board_admin(user: dict, board_id: str) -> bool:
    return board_role(user, board_id) == "admin"


def require_write(user: dict, board_id: str):
    if not can_write(user, board_id):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения этой доски")


def board_of_list(list_id: str) -> Optional[str]:
    with db.get_conn() as conn:
        row = conn.execute("SELECT board_id FROM lists WHERE id=?", (list_id,)).fetchone()
        return row["board_id"] if row else None


def board_of_card(card_id: str) -> Optional[str]:
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT l.board_id AS b FROM cards c JOIN lists l ON l.id=c.list_id WHERE c.id=?",
            (card_id,),
        ).fetchone()
        return row["b"] if row else None
