"""Board join flow: request access -> admin approves/denies."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import database as db
import auth
import notify
import discovery
import json as _json
from config import HTTP_PORT

router = APIRouter()


class ApproveIn(BaseModel):
    role: str = "member"


@router.get("/api/net-info")
def net_info():
    """LAN address others use to reach this device (+ Tailscale IP if present)."""
    return {"ip": discovery._local_ip(), "tailscale_ip": discovery._tailscale_ip(), "port": HTTP_PORT}


@router.get("/api/public-ip")
def public_ip():
    """Best-effort public (WAN) IP for the port-forwarding option."""
    import urllib.request
    for url in ("https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"):
        try:
            with urllib.request.urlopen(url, timeout=4) as r:
                ip = r.read().decode().strip()
                parts = ip.split(".")
                if len(parts) == 4 and all(o.isdigit() and 0 <= int(o) <= 255 for o in parts):
                    return {"ip": ip}
        except Exception:
            continue
    return {"ip": None}


@router.get("/api/boards/{board_id}/public")
def board_public(board_id: str):
    """Minimal board info for the join screen (no auth)."""
    with db.get_conn() as conn:
        row = conn.execute("SELECT id, name, color FROM boards WHERE id=?", (board_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Доска не найдена")
    return db.dict_from_row(row)


@router.get("/api/boards/{board_id}/my-access")
def my_access(board_id: str, user: dict = Depends(auth.require_user)):
    role = auth.board_role(user, board_id)
    if role:
        return {"state": "member", "role": role}
    with db.get_conn() as conn:
        r = conn.execute("SELECT status FROM board_join_requests WHERE board_id=? AND user_id=? ORDER BY requested_at DESC LIMIT 1",
                         (board_id, user["id"])).fetchone()
    return {"state": r["status"] if r else "none"}


@router.post("/api/boards/{board_id}/join-request")
def request_join(board_id: str, user: dict = Depends(auth.require_user)):
    if auth.board_role(user, board_id):
        return {"state": "member"}
    with db.get_conn() as conn:
        board = conn.execute("SELECT name, accept_members, require_approval FROM boards WHERE id=?", (board_id,)).fetchone()
        if not board:
            raise HTTPException(404, "Доска не найдена")
        if board["accept_members"] == 0:
            raise HTTPException(403, "Доска закрыта для новых участников")
        bname = board["name"]
        auto = board["require_approval"] == 0
        if auto:
            perms = _json.dumps(auth.default_perms("member"))
            conn.execute("INSERT INTO board_members (board_id, user_id, role, permissions) VALUES (?,?,?,?) "
                         "ON CONFLICT(board_id, user_id) DO NOTHING", (board_id, user["id"], "member", perms))
        else:
            existing = conn.execute(
                "SELECT * FROM board_join_requests WHERE board_id=? AND user_id=? AND status='pending'",
                (board_id, user["id"])).fetchone()
            if not existing:
                conn.execute("INSERT INTO board_join_requests (id, board_id, user_id, status, requested_at) VALUES (?,?,?,?,?)",
                             (db.new_id(), board_id, user["id"], "pending", db.now()))
    # notify AFTER the transaction is closed (avoid SQLite write lock)
    if auto:
        notify.notify_board_admins(board_id, "member_joined",
                                   f"{user['display_name']} присоединился(ась) к доске «{bname}»",
                                   {"board_id": board_id}, exclude=user["id"])
        return {"state": "member"}
    notify.notify_board_admins(board_id, "join_request",
                               f"{user['display_name']} запрашивает доступ к доске «{bname}»",
                               {"board_id": board_id, "user_id": user["id"]})
    return {"state": "pending"}


@router.get("/api/join-requests")
def pending_requests(user: dict = Depends(auth.require_user)):
    """Pending requests on boards the current user administers."""
    out = []
    with db.get_conn() as conn:
        rows = conn.execute(
            """SELECT jr.id, jr.board_id, jr.requested_at, b.name AS board_name,
                      u.id AS user_id, u.display_name, u.username, u.color
               FROM board_join_requests jr
               JOIN boards b ON b.id = jr.board_id
               JOIN users u ON u.id = jr.user_id
               WHERE jr.status='pending' ORDER BY jr.requested_at DESC""").fetchall()
        for r in rows:
            r = db.dict_from_row(r)
            if auth.is_board_admin(user, r["board_id"]):
                out.append(r)
    return out


def _resolve(req_id, user, decision, role="member"):
    with db.get_conn() as conn:
        jr = conn.execute("SELECT * FROM board_join_requests WHERE id=?", (req_id,)).fetchone()
        if not jr:
            raise HTTPException(404, "Заявка не найдена")
        jr = db.dict_from_row(jr)
        if not auth.is_board_admin(user, jr["board_id"]):
            raise HTTPException(403, "Только админ доски может решать")
        board = conn.execute("SELECT name FROM boards WHERE id=?", (jr["board_id"],)).fetchone()
        conn.execute("UPDATE board_join_requests SET status=? WHERE id=?", (decision, req_id))
        if decision == "approved":
            conn.execute("INSERT INTO board_members (board_id, user_id, role) VALUES (?,?,?) "
                         "ON CONFLICT(board_id, user_id) DO UPDATE SET role=?",
                         (jr["board_id"], jr["user_id"], role, role))
    bname = board["name"] if board else ""
    if decision == "approved":
        notify.push(jr["user_id"], "access_granted", f"Доступ к доске «{bname}» одобрен (роль: {role})",
                    {"board_id": jr["board_id"]})
    else:
        notify.push(jr["user_id"], "access_denied", f"Доступ к доске «{bname}» отклонён",
                    {"board_id": jr["board_id"]})
    return {"ok": True}


@router.post("/api/join-requests/{req_id}/approve")
def approve(req_id: str, data: ApproveIn, user: dict = Depends(auth.require_user)):
    return _resolve(req_id, user, "approved", data.role)


@router.post("/api/join-requests/{req_id}/deny")
def deny(req_id: str, user: dict = Depends(auth.require_user)):
    return _resolve(req_id, user, "denied")
