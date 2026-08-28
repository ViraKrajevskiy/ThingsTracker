"""Card comments."""
from fastapi import APIRouter, Depends
import database as db
from models import CommentIn
from realtime import manager
import auth

router = APIRouter()


@router.get("/api/cards/{card_id}/comments")
def get_comments(card_id: str):
    with db.get_conn() as conn:
        rows = conn.execute("SELECT * FROM comments WHERE card_id=? ORDER BY created_at", (card_id,)).fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.post("/api/cards/{card_id}/comments")
async def add_comment(card_id: str, data: CommentIn, user: dict = Depends(auth.require_user)):
    auth.require_perm(user, auth.board_of_card(card_id), 'comment')
    cid = db.new_id()
    t = db.now()
    with db.get_conn() as conn:
        conn.execute("INSERT INTO comments (id, card_id, author, text, created_at) VALUES (?,?,?,?,?)",
                     (cid, card_id, data.author, data.text, t))
    await manager.broadcast({"type": "comment_added", "card_id": card_id})
    return {"id": cid, "card_id": card_id, "author": data.author, "text": data.text, "created_at": t}


@router.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM comments WHERE id=?", (comment_id,))
    await manager.broadcast({"type": "comment_deleted"})
    return {"ok": True}
