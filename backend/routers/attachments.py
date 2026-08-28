"""File attachments (photos, video, code, any files)."""
import os
from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import FileResponse
import database as db
from config import ATTACH_DIR
from realtime import manager
import auth

router = APIRouter()


@router.get("/api/cards/{card_id}/attachments")
def list_attachments(card_id: str):
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, card_id, filename, mimetype, size, created_at FROM attachments WHERE card_id=? ORDER BY created_at",
            (card_id,),
        ).fetchall()
        return [db.dict_from_row(r) for r in rows]


@router.post("/api/cards/{card_id}/attachments")
async def upload_attachment(card_id: str, file: UploadFile = File(...), user: dict = Depends(auth.require_user)):
    auth.require_write(user, auth.board_of_card(card_id))
    aid = db.new_id()
    ext = os.path.splitext(file.filename or "")[1]
    stored = aid + ext
    data = await file.read()
    with open(os.path.join(ATTACH_DIR, stored), "wb") as f:
        f.write(data)
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO attachments (id, card_id, filename, mimetype, size, stored_name, created_at) VALUES (?,?,?,?,?,?,?)",
            (aid, card_id, file.filename, file.content_type, len(data), stored, db.now()),
        )
    await manager.broadcast({"type": "attachment_added", "card_id": card_id})
    return {"id": aid, "card_id": card_id, "filename": file.filename,
            "mimetype": file.content_type, "size": len(data)}


@router.get("/api/attachments/{att_id}")
def get_attachment(att_id: str, download: int = 0):
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM attachments WHERE id=?", (att_id,)).fetchone()
        if not row:
            return {"error": "not found"}
        row = db.dict_from_row(row)
    path = os.path.join(ATTACH_DIR, row["stored_name"])
    if not os.path.isfile(path):
        return {"error": "file missing"}
    disp = "attachment" if download else "inline"
    return FileResponse(path, media_type=row["mimetype"] or "application/octet-stream",
                        filename=row["filename"],
                        headers={"Content-Disposition": f'{disp}; filename="{row["filename"]}"'})


@router.delete("/api/attachments/{att_id}")
async def delete_attachment(att_id: str, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM attachments WHERE id=?", (att_id,)).fetchone()
        if row:
            row = db.dict_from_row(row)
            try:
                os.remove(os.path.join(ATTACH_DIR, row["stored_name"]))
            except Exception:
                pass
            conn.execute("DELETE FROM attachments WHERE id=?", (att_id,))
    await manager.broadcast({"type": "attachment_deleted"})
    return {"ok": True}
