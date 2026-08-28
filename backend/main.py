"""ThingTracker backend — application entry point.

Wires together the routers. Each feature lives in its own module:
  models.py         — request schemas
  database.py       — SQLite storage + migrations
  realtime.py       — WebSocket manager + /ws
  discovery.py      — mDNS LAN announcement
  config.py         — port + paths
  routers/          — boards, lists, cards, statuses, comments, attachments, settings
"""
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import database as db
from config import HTTP_PORT
from discovery import start_mdns
from realtime import router as ws_router
from routers import boards, lists, cards, statuses, comments, settings
from routers import auth_router, users, join, notifications
try:
    from routers import attachments
    _HAS_ATTACHMENTS = True
except Exception as _e:
    print(f"[warn] attachments disabled (install python-multipart): {_e}")
    _HAS_ATTACHMENTS = False

app = FastAPI(title="ThingTracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()
    start_mdns()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ThingTracker"}


# feature routers
for r in (auth_router, users, join, notifications, boards, lists, cards, statuses, comments, settings):
    app.include_router(r.router)
if _HAS_ATTACHMENTS:
    try:
        app.include_router(attachments.router)
    except Exception as _e:
        print(f"[warn] attachments disabled (install python-multipart): {_e}")
app.include_router(ws_router)


# serve the built frontend (for PWA / mobile). Mounted last so /api and /ws win.
def _frontend_dir():
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "frontend_dist")
    return os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


_cand = _frontend_dir()
if os.path.isdir(_cand):
    app.mount("/", StaticFiles(directory=_cand, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=HTTP_PORT)
