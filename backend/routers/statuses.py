"""Global editable statuses."""
from fastapi import APIRouter, Depends
import database as db
from models import StatusIn, StatusUpdate
from realtime import manager
import auth

router = APIRouter()


@router.get("/api/statuses")
def get_statuses():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM statuses ORDER BY position").fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.post("/api/statuses")
async def create_status(data: StatusIn, user: dict = Depends(auth.require_user)):
    sid = db.new_id()
    with db.get_conn() as conn:
        pos = conn.execute("SELECT COALESCE(MAX(position),-1)+1 AS p FROM statuses").fetchone()["p"]
        conn.execute("INSERT INTO statuses (id, label, color, position) VALUES (?,?,?,?)",
                     (sid, data.label, data.color, pos))
    await manager.broadcast({"type": "statuses_updated"})
    return {"id": sid, "label": data.label, "color": data.color, "position": pos}


@router.patch("/api/statuses/{status_id}")
async def update_status(status_id: str, data: StatusUpdate, user: dict = Depends(auth.require_user)):
    fields = data.dict(exclude_unset=True)
    if not fields:
        return {"error": "nothing to update"}
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE statuses SET {sets} WHERE id=?", list(fields.values()) + [status_id])
    await manager.broadcast({"type": "statuses_updated"})
    return {"ok": True}


@router.delete("/api/statuses/{status_id}")
async def delete_status(status_id: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM statuses WHERE id=?", (status_id,))
        first = conn.execute("SELECT id FROM statuses ORDER BY position LIMIT 1").fetchone()
        fallback = first["id"] if first else "open"
        conn.execute("UPDATE cards SET status=? WHERE status=?", (fallback, status_id))
    await manager.broadcast({"type": "statuses_updated"})
    return {"ok": True}
