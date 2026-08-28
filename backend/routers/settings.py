"""Global default settings."""
from fastapi import APIRouter, Depends
import database as db
import auth

router = APIRouter()


@router.get("/api/settings")
def get_settings():
    with db.get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}


@router.patch("/api/settings")
async def update_settings(data: dict, user: dict = Depends(auth.require_user)):
    with db.get_conn() as conn:
        for k, v in data.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?",
                (k, str(v), str(v)),
            )
    return {"ok": True}
