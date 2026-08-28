# -*- mode: python ; coding: utf-8 -*-
# Builds a single self-contained backend binary (Win/Mac/Linux — build on each OS).
# Bundles the built frontend so the same binary serves the PWA to phones.
import os
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = [], [], []
for pkg in ["uvicorn", "zeroconf", "fastapi", "starlette", "websockets", "ifaddr", "multipart", "anyio"]:
    try:
        d, b, h = collect_all(pkg)
        datas += d; binaries += b; hiddenimports += h
    except Exception:
        pass

# local backend modules (some are imported lazily, so name them explicitly)
hiddenimports += [
    "auth", "notify", "config", "models", "database", "discovery", "realtime",
    "python_multipart", "multipart",
    "routers", "routers.auth_router", "routers.users", "routers.join",
    "routers.notifications", "routers.boards", "routers.lists", "routers.cards",
    "routers.statuses", "routers.comments", "routers.attachments", "routers.settings",
]

# bundle the built frontend if present
_fe = os.path.join("..", "frontend", "dist")
if os.path.isdir(_fe):
    datas.append((_fe, "frontend_dist"))

a = Analysis(["main.py"], pathex=["."], binaries=binaries, datas=datas,
             hiddenimports=hiddenimports, hookspath=[], hooksconfig={},
             runtime_hooks=[], excludes=[], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="thingtracker-backend",
          debug=False, bootloader_ignore_signals=False, strip=False, upx=True,
          runtime_tmpdir=None, console=False)
