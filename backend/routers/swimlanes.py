"""Swimlanes — horizontal side rows across the columns."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import database as db
import auth
from realtime import manager

router = APIRouter()


class SwimlaneIn(BaseModel):
    name: str
    color: Optional[str] = "#7A97C8"


class SwimlaneUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    collapsed: Optional[int] = None


class SwimlaneReorder(BaseModel):
    board_id: str
    order: List[str]


class SwimlaneMode(BaseModel):
    swimlane_mode: str  # off | manual | group
    swimlane_field: Optional[str] = None  # for 'group': assignee | priority | status


def _require_manage(user, board_id):
    if not (auth.is_board_admin(user, board_id) or auth.can(user, board_id, "manage_swimlanes")):
        raise HTTPException(403, "Недостаточно прав для управления свимлейнами")


@router.get("/api/boards/{board_id}/swimlanes")
def list_swimlanes(board_id: str, user: dict = Depends(auth.require_user)):
    if not auth.board_role(user, board_id):
        raise HTTPException(403, "Нет доступа")
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM swimlanes WHERE board_id=? ORDER BY position",
                            (board_id,)).fetchall()
    return [db.dict_from_row(r) for r in rows]


@router.post("/api/boards/{board_id}/swimlanes")
async def create_swimlane(board_id: str, data: SwimlaneIn, user: dict = Depends(auth.require_user)):
    _require_manage(user, board_id)
    with db.get_conn() as conn:
        pos = conn.execute("SELECT COALESCE(MAX(position),-1)+1 AS p FROM swimlanes WHERE board_id=?",
                           (board_id,)).fetchone()["p"]
        sid = db.new_id()
        conn.execute("INSERT INTO swimlanes (id, board_id, name, color, position, collapsed) VALUES (?,?,?,?,?,0)",
                     (sid, board_id, data.name.strip() or "Без названия", data.color or "#7A97C8", pos))
        row = conn.execute("SELECT * FROM swimlanes WHERE id=?", (sid,)).fetchone()
    result = db.dict_from_row(row)
    await manager.broadcast({"type": "swimlane_created", "swimlane": result})
    return result


@router.patch("/api/swimlanes/{sid}")
async def update_swimlane(sid: str, data: SwimlaneUpdate, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        row = conn.execute("SELECT board_id FROM swimlanes WHERE id=?", (sid,)).fetchone()
        if not row:
            raise HTTPException(404, "Свимлейн не найден")
        board_id = row["board_id"]
    _require_manage(user, board_id)
    fields = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if not fields:
        return {"ok": True}
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE swimlanes SET {sets} WHERE id=?", list(fields.values()) + [sid])
        row = conn.execute("SELECT * FROM swimlanes WHERE id=?", (sid,)).fetchone()
    result = db.dict_from_row(row)
    await manager.broadcast({"type": "swimlane_updated", "swimlane": result})
    return result


@router.delete("/api/swimlanes/{sid}")
async def delete_swimlane(sid: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        row = conn.execute("SELECT board_id FROM swimlanes WHERE id=?", (sid,)).fetchone()
        if not row:
            return {"ok": True}
        board_id = row["board_id"]
    _require_manage(user, board_id)
    with db.get_conn() as conn:
        # cards in this swimlane fall back to "no swimlane" (NULL)
        conn.execute("UPDATE cards SET swimlane_id=NULL WHERE swimlane_id=?", (sid,))
        conn.execute("DELETE FROM swimlanes WHERE id=?", (sid,))
    await manager.broadcast({"type": "swimlane_deleted", "id": sid, "board_id": board_id})
    return {"ok": True}


@router.post("/api/swimlanes/reorder")
async def reorder_swimlanes(data: SwimlaneReorder, user: dict = Depends(auth.require_user)):
    _require_manage(user, data.board_id)
    with db.get_conn() as conn:
        for i, sid in enumerate(data.order):
            conn.execute("UPDATE swimlanes SET position=? WHERE id=? AND board_id=?",
                         (i, sid, data.board_id))
    await manager.broadcast({"type": "swimlanes_reordered", "board_id": data.board_id, "order": data.order})
    return {"ok": True}


@router.patch("/api/boards/{board_id}/swimlane-mode")
async def set_swimlane_mode(board_id: str, data: SwimlaneMode, user: dict = Depends(auth.require_user)):
    _require_manage(user, board_id)
    if data.swimlane_mode not in ("off", "manual", "group"):
        raise HTTPException(400, "Неверный режим")
    with db.get_conn() as conn:
        conn.execute("UPDATE boards SET swimlane_mode=?, swimlane_field=? WHERE id=?",
                     (data.swimlane_mode, data.swimlane_field, board_id))
    await manager.broadcast({"type": "board_swimlane_mode", "board_id": board_id,
                              "swimlane_mode": data.swimlane_mode, "swimlane_field": data.swimlane_field})
    return {"ok": True}
