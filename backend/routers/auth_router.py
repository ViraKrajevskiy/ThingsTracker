"""Login / registration / current user."""
from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional
import database as db
import auth
from models import RegisterIn, LoginIn

router = APIRouter()


def _public(user: dict) -> dict:
    return {k: user[k] for k in ("id", "username", "display_name", "color", "global_role", "activated")}


@router.post("/api/auth/register")
def register(data: RegisterIn):
    uname = data.username.strip().lower()
    if not uname or not data.password:
        raise HTTPException(400, "Укажите логин и пароль")
    with db.get_conn() as conn:
        existing = conn.execute("SELECT * FROM users WHERE username=?", (uname,)).fetchone()
        if existing:
            existing = db.dict_from_row(existing)
            # allow activating an admin-created account that has no password yet
            if existing["activated"] and existing["password_hash"]:
                raise HTTPException(409, "Такой логин уже занят")
            conn.execute(
                "UPDATE users SET password_hash=?, activated=1, display_name=? WHERE id=?",
                (auth.hash_password(data.password), data.display_name or existing["display_name"], existing["id"]),
            )
            uid = existing["id"]
        else:
            uid = db.new_id()
            conn.execute(
                "INSERT INTO users (id, username, password_hash, display_name, color, global_role, activated, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (uid, uname, auth.hash_password(data.password), data.display_name or data.username, "#35D0F0", "user", 1, db.now()),
            )
    token = auth.create_session(uid)
    with db.get_conn() as conn:
        user = db.dict_from_row(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    return {"token": token, "user": _public(user)}


@router.post("/api/auth/login")
def login(data: LoginIn):
    uname = data.username.strip().lower()
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE username=?", (uname,)).fetchone()
    user = db.dict_from_row(row) if row else None
    if not user or not auth.verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Неверный логин или пароль")
    token = auth.create_session(user["id"])
    return {"token": token, "user": _public(user)}


@router.get("/api/auth/me")
def me(authorization: Optional[str] = Header(None)):
    user = auth.optional_user(authorization)
    if not user:
        raise HTTPException(401, "Не авторизован")
    return _public(user)


@router.get("/api/auth/bootstrap")
def bootstrap(request: Request):
    """Auto-login the local owner (desktop app on localhost) so the owner
    never sees a login screen on their own machine. Remote clients get 403
    and must register + request board access instead."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "Bootstrap only available locally")
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE global_role='owner' ORDER BY created_at LIMIT 1").fetchone()
    if not row:
        raise HTTPException(404, "Владелец не найден")
    user = db.dict_from_row(row)
    token = auth.create_session(user["id"])
    return {"token": token, "user": _public(user)}


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    tok = auth._token_from_header(authorization)
    if tok:
        auth.drop_session(tok)
    return {"ok": True}
