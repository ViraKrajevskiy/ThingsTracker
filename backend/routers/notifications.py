"""In-app notification feed."""
from fastapi import APIRouter, Depends
import database as db
import auth

router = APIRouter()


@router.get("/api/notifications")
def list_notifications(user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id=? ORDER BY read ASC, created_at DESC LIMIT 60",
            (user["id"],)).fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.get("/api/notifications/count")
def unread_count(user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read=0",
                         (user["id"],)).fetchone()["n"]
    return {"count": n}


@router.post("/api/notifications/{nid}/read")
def mark_read(nid: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        conn.execute("UPDATE notifications SET read=1 WHERE id=? AND user_id=?", (nid, user["id"]))
    return {"ok": True}


@router.post("/api/notifications/read-all")
def mark_all_read(user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        conn.execute("UPDATE notifications SET read=1 WHERE user_id=?", (user["id"],))
    return {"ok": True}
