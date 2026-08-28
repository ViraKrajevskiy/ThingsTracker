"""User management (admin) + per-board membership & roles."""
from fastapi import APIRouter, Depends, HTTPException
import database as db
import auth, json
from models import UserCreate, UserUpdate, BoardMemberIn

router = APIRouter()


def _pub(u: dict) -> dict:
    return {k: u[k] for k in ("id", "username", "display_name", "color", "global_role", "activated")}


def require_owner(user: dict = Depends(auth.require_user)):
    if user.get("global_role") != "owner":
        raise HTTPException(403, "Только владелец может управлять пользователями")
    return user


@router.get("/api/users")
def list_users(user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at").fetchall()
        return [_pub(db.dict_from_row(r)) for r in rows]


@router.post("/api/users")
def create_user(data: UserCreate, user: dict = Depends(require_owner)):
    uname = data.username.strip().lower()
    if not uname:
        raise HTTPException(400, "Укажите логин")
    with db.get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (uname,)).fetchone():
            raise HTTPException(409, "Такой логин уже занят")
        uid = db.new_id()
        ph = auth.hash_password(data.password) if data.password else None
        conn.execute(
            "INSERT INTO users (id, username, password_hash, display_name, color, global_role, activated, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (uid, uname, ph, data.display_name, data.color, data.global_role, 1 if data.password else 0, db.now()),
        )
    return {"id": uid, "username": uname, "display_name": data.display_name,
            "temp_password": data.password, "activated": bool(data.password)}


@router.patch("/api/users/{user_id}")
def update_user(user_id: str, data: UserUpdate, user: dict = Depends(require_owner)):
    fields = {}
    for k in ("display_name", "color", "global_role"):
        v = getattr(data, k)
        if v is not None:
            fields[k] = v
    if data.password:
        fields["password_hash"] = auth.hash_password(data.password)
        fields["activated"] = 1
    if not fields:
        return {"ok": True}
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE users SET {sets} WHERE id=?", list(fields.values()) + [user_id])
    return {"ok": True}


@router.delete("/api/users/{user_id}")
def delete_user(user_id: str, user: dict = Depends(require_owner)):
    if user_id == user["id"]:
        raise HTTPException(400, "Нельзя удалить самого себя")
    with db.get_conn() as conn:
        conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    return {"ok": True}


@router.get("/api/boards/{board_id}/members")
def board_members(board_id: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        rows = conn.execute(
            """SELECT bm.role, bm.permissions, u.id, u.username, u.display_name, u.color, u.global_role, u.activated
               FROM board_members bm JOIN users u ON u.id = bm.user_id WHERE bm.board_id=?""",
            (board_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = db.dict_from_row(r)
            try:
                d["permissions"] = json.loads(d.get("permissions") or "{}")
            except Exception:
                d["permissions"] = {}
            out.append(d)
        return out


@router.post("/api/boards/{board_id}/members")
def add_board_member(board_id: str, data: BoardMemberIn, user: dict = Depends(auth.require_user)):
    if not (auth.is_board_admin(user, board_id) or auth.can(user, board_id, "manage_members")):
        raise HTTPException(403, "Недостаточно прав для управления участниками")
    # default permissions by role when not explicitly provided
    if data.permissions is not None:
        base = auth.default_perms(data.role)
        perms = {k: (bool(data.permissions[k]) if k in data.permissions else base[k]) for k in auth.PERM_KEYS}
    else:
        perms = auth.default_perms(data.role)
    pj = json.dumps(perms)
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO board_members (board_id, user_id, role, permissions) VALUES (?,?,?,?) "
            "ON CONFLICT(board_id, user_id) DO UPDATE SET role=?, permissions=?",
            (board_id, data.user_id, data.role, pj, data.role, pj),
        )
        # granting access directly resolves any pending join request (removes it from notifications)
        conn.execute("UPDATE board_join_requests SET status='approved' WHERE board_id=? AND user_id=? AND status='pending'",
                     (board_id, data.user_id))
    return {"ok": True}


@router.delete("/api/boards/{board_id}/members/{user_id}")
def remove_board_member(board_id: str, user_id: str, user: dict = Depends(auth.require_user)):
    if not (auth.is_board_admin(user, board_id) or auth.can(user, board_id, "manage_members")):
        raise HTTPException(403, "Недостаточно прав для управления участниками")
    with db.get_conn() as conn:
        conn.execute("DELETE FROM board_members WHERE board_id=? AND user_id=?", (board_id, user_id))
    return {"ok": True}
