"""List (column) endpoints: create, rename, move, delete."""
from fastapi import APIRouter, Depends, HTTPException
import database as db
from models import ListIn, ListUpdate, MoveList
from realtime import manager
import auth

router = APIRouter()


@router.post("/api/lists")
async def create_list(data: ListIn, user: dict = Depends(auth.require_user)):
    auth.require_write(user, data.board_id)
    lid = db.new_id()
    with db.get_conn() as conn:
        pos = conn.execute(
            "SELECT COALESCE(MAX(position),-1)+1 AS p FROM lists WHERE board_id=?",
            (data.board_id,),
        ).fetchone()["p"]
        conn.execute("INSERT INTO lists (id, board_id, name, position) VALUES (?,?,?,?)",
                     (lid, data.board_id, data.name, pos))
    await manager.broadcast({"type": "list_created", "board_id": data.board_id})
    return {"id": lid, "board_id": data.board_id, "name": data.name, "position": pos, "cards": []}


@router.patch("/api/lists/{list_id}")
async def update_list(list_id: str, data: ListUpdate, user: dict = Depends(auth.require_user)):
    auth.require_write(user, auth.board_of_list(list_id))
    fields = data.dict(exclude_unset=True)
    if not fields:
        return {"error": "nothing to update"}
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE lists SET {sets} WHERE id=?", list(fields.values()) + [list_id])
    await manager.broadcast({"type": "list_updated"})
    return {"ok": True}


@router.post("/api/lists/move")
async def move_list(data: MoveList, user: dict = Depends(auth.require_user)):
    auth.require_write(user, auth.board_of_list(data.list_id))
    with db.get_conn() as conn:
        row = conn.execute("SELECT board_id FROM lists WHERE id=?", (data.list_id,)).fetchone()
        if not row:
            return {"error": "not found"}
        board_id = row["board_id"]
        lists = conn.execute("SELECT id FROM lists WHERE board_id=? ORDER BY position", (board_id,)).fetchall()
        ids = [l["id"] for l in lists if l["id"] != data.list_id]
        ids.insert(data.position, data.list_id)
        for i, lid in enumerate(ids):
            conn.execute("UPDATE lists SET position=? WHERE id=?", (i, lid))
    await manager.broadcast({"type": "list_moved"})
    return {"ok": True}


@router.delete("/api/lists/{list_id}")
async def delete_list(list_id: str, user: dict = Depends(auth.require_user)):
    auth.require_write(user, auth.board_of_list(list_id))
    with db.get_conn() as conn:
        conn.execute("DELETE FROM cards WHERE list_id=?", (list_id,))
        conn.execute("DELETE FROM lists WHERE id=?", (list_id,))
    await manager.broadcast({"type": "list_deleted"})
    return {"ok": True}
