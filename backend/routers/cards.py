"""Card endpoints: create, update, move, delete."""
import json
from fastapi import APIRouter, Depends, HTTPException
import database as db
from models import CardIn, CardUpdate, MoveCard
from realtime import manager
import auth
import notify

router = APIRouter()


@router.post("/api/cards")
async def create_card(data: CardIn, user: dict = Depends(auth.require_user)):
    auth.require_perm(user, auth.board_of_list(data.list_id), 'create_cards')
    cid = db.new_id()
    t = db.now()
    with db.get_conn() as conn:
        pos = conn.execute(
            "SELECT COALESCE(MAX(position),-1)+1 AS p FROM cards WHERE list_id=?",
            (data.list_id,),
        ).fetchone()["p"]
        conn.execute(
            """INSERT INTO cards (id, list_id, title, description, position, priority, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (cid, data.list_id, data.title, data.description, pos, data.priority, data.status, t, t),
        )
        card = db.dict_from_row(conn.execute("SELECT * FROM cards WHERE id=?", (cid,)).fetchone())
    notify.notify_board_admins(auth.board_of_card(cid), "card_change",
        f"{user['display_name']} добавил(а) карточку «{data.title}»", {"card_id": cid}, exclude=user["id"])
    await manager.broadcast({"type": "card_created", "card": card})
    return card


@router.patch("/api/cards/{card_id}")
async def update_card(card_id: str, data: CardUpdate, user: dict = Depends(auth.require_user)):
    bid = auth.board_of_card(card_id)
    changed = data.dict(exclude_unset=True)
    keys = set(changed.keys())
    move_keys = {"status", "list_id", "position", "swimlane_id"}
    if keys <= move_keys:
        auth.require_perm(user, bid, "move_cards")
    else:
        if "due_date" in keys:
            auth.require_perm(user, bid, "set_deadline")
        # any other content change requires edit_cards
        if keys - move_keys - {"due_date"}:
            auth.require_perm(user, bid, "edit_cards")
    fields = data.dict(exclude_unset=True)
    if not fields:
        return {"error": "nothing to update"}
    if "labels" in fields:
        fields["labels"] = json.dumps(fields["labels"])
    fields["updated_at"] = db.now()
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE cards SET {sets} WHERE id=?", list(fields.values()) + [card_id])
        card = db.dict_from_row(conn.execute("SELECT * FROM cards WHERE id=?", (card_id,)).fetchone())
    notify.notify_board_admins(auth.board_of_card(card_id), "card_change",
        f"{user['display_name']} изменил(а) карточку «{card['title']}»", {"card_id": card_id}, exclude=user["id"])
    await manager.broadcast({"type": "card_updated", "card": card})
    return card


@router.post("/api/cards/move")
async def move_card(data: MoveCard, user: dict = Depends(auth.require_user)):
    auth.require_perm(user, auth.board_of_card(data.card_id), 'move_cards')
    with db.get_conn() as conn:
        conn.execute("UPDATE cards SET position = position + 1 WHERE list_id=? AND position >= ?",
                     (data.list_id, data.position))
        sl = data.swimlane_id if data.swimlane_id is not None else None
        if data.swimlane_id is not None:
            conn.execute("UPDATE cards SET list_id=?, position=?, swimlane_id=?, updated_at=? WHERE id=?",
                         (data.list_id, data.position, sl, db.now(), data.card_id))
        else:
            conn.execute("UPDATE cards SET list_id=?, position=?, updated_at=? WHERE id=?",
                         (data.list_id, data.position, db.now(), data.card_id))
    notify.notify_board_admins(auth.board_of_card(data.card_id), "card_change",
        f"{user['display_name']} переместил(а) карточку", {"card_id": data.card_id}, exclude=user["id"])
    await manager.broadcast({"type": "card_moved", "card_id": data.card_id,
                             "list_id": data.list_id, "position": data.position, "swimlane_id": sl})
    return {"ok": True}


@router.delete("/api/cards/{card_id}")
async def delete_card(card_id: str, user: dict = Depends(auth.require_user)):
    auth.require_perm(user, auth.board_of_card(card_id), 'delete_cards')
    with db.get_conn() as conn:
        conn.execute("DELETE FROM cards WHERE id=?", (card_id,))
    await manager.broadcast({"type": "card_deleted", "card_id": card_id})
    return {"ok": True}
