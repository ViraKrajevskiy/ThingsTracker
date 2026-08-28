"""Polls attached to cards: single- or multiple-choice voting."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import database as db
import auth
from realtime import manager

router = APIRouter()


class PollIn(BaseModel):
    multi: bool = False
    options: List[str] = []


class VoteIn(BaseModel):
    option_ids: List[str] = []


def poll_data(card_id: str, user_id: str = None):
    with db.get_conn() as conn:
        card = conn.execute("SELECT poll_multi FROM cards WHERE id=?", (card_id,)).fetchone()
        opts = conn.execute("SELECT * FROM poll_options WHERE card_id=? ORDER BY position", (card_id,)).fetchall()
        if not opts:
            return {"is_poll": False}
        counts = {r["option_id"]: r["n"] for r in conn.execute(
            "SELECT option_id, COUNT(*) AS n FROM poll_votes WHERE card_id=? GROUP BY option_id", (card_id,)).fetchall()}
        mine = set()
        if user_id:
            mine = {r["option_id"] for r in conn.execute(
                "SELECT option_id FROM poll_votes WHERE card_id=? AND user_id=?", (card_id, user_id)).fetchall()}
        total_voters = conn.execute(
            "SELECT COUNT(DISTINCT user_id) AS n FROM poll_votes WHERE card_id=?", (card_id,)).fetchone()["n"]
    options = [{"id": o["id"], "text": o["text"], "votes": counts.get(o["id"], 0), "voted": o["id"] in mine}
               for o in opts]
    return {"is_poll": True, "multi": bool(card["poll_multi"]) if card else False,
            "options": options, "total_voters": total_voters}


@router.get("/api/cards/{card_id}/poll")
def get_poll(card_id: str, user: dict = Depends(auth.require_user)):
    return poll_data(card_id, user["id"])


@router.post("/api/cards/{card_id}/poll")
async def set_poll(card_id: str, data: PollIn, user: dict = Depends(auth.require_user)):
    auth.require_perm(user, auth.board_of_card(card_id), "edit_cards")
    opts = [o.strip() for o in data.options if o.strip()]
    with db.get_conn() as conn:
        conn.execute("UPDATE cards SET poll_multi=? WHERE id=?", (1 if data.multi else 0, card_id))
        conn.execute("DELETE FROM poll_votes WHERE card_id=?", (card_id,))
        conn.execute("DELETE FROM poll_options WHERE card_id=?", (card_id,))
        for i, text in enumerate(opts):
            conn.execute("INSERT INTO poll_options (id, card_id, text, position) VALUES (?,?,?,?)",
                         (db.new_id(), card_id, text, i))
    await manager.broadcast({"type": "card_updated", "card_id": card_id})
    return poll_data(card_id, user["id"])


@router.post("/api/cards/{card_id}/vote")
async def vote(card_id: str, data: VoteIn, user: dict = Depends(auth.require_user)):
    bid = auth.board_of_card(card_id)
    if auth.board_role(user, bid) is None:
        raise HTTPException(403, "Нет доступа к доске")
    with db.get_conn() as conn:
        card = conn.execute("SELECT poll_multi FROM cards WHERE id=?", (card_id,)).fetchone()
        multi = bool(card["poll_multi"]) if card else False
        valid = {r["id"] for r in conn.execute("SELECT id FROM poll_options WHERE card_id=?", (card_id,)).fetchall()}
        chosen = [o for o in data.option_ids if o in valid]
        if not multi:
            chosen = chosen[:1]
        # replace this user's votes on this card
        conn.execute("DELETE FROM poll_votes WHERE card_id=? AND user_id=?", (card_id, user["id"]))
        for oid in chosen:
            conn.execute("INSERT OR IGNORE INTO poll_votes (id, card_id, option_id, user_id) VALUES (?,?,?,?)",
                         (db.new_id(), card_id, oid, user["id"]))
    await manager.broadcast({"type": "card_updated", "card_id": card_id})
    return poll_data(card_id, user["id"])
