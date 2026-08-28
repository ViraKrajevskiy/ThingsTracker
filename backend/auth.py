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


def can_write(user: dict, board_id: str) -> bool:
    return board_role(user, board_id) in ("admin", "member")


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
