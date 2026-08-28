"""Shared configuration for ThingTracker backend."""
import os

# Port is chosen by the launcher (Electron) via TT_PORT; 8766 when standalone.
HTTP_PORT = int(os.environ.get("TT_PORT", "8766"))

# Directory where uploaded attachments are stored.
ATTACH_DIR = os.path.join(os.path.dirname(__file__), "attachments")
os.makedirs(ATTACH_DIR, exist_ok=True)
