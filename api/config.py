import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_HOST = "0.0.0.0"
API_PORT = 8000

_extra_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] + ([o.strip() for o in _extra_origins.split(",") if o.strip()] if _extra_origins else [])
