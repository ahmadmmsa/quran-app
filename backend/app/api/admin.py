import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any
from backend.app.api.auth import get_current_admin_user

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin_user)])

_FRONTEND = Path(__file__).resolve().parents[3] / "frontend"


def _locales_path() -> Path:
    # The app serves /locales.json from dist (see main.py), so edit that file to
    # keep the editor and the running app in sync. In the container it is
    # bind-mounted to the host's frontend/public/locales.json, so edits persist
    # across rebuilds. Falls back to public/ for local (non-docker) dev.
    dist = _FRONTEND / "dist" / "locales.json"
    return dist if dist.exists() else _FRONTEND / "public" / "locales.json"

@router.get("/locales")
async def get_locales():
    path = _locales_path()
    if not path.exists():
        raise HTTPException(status_code=404, detail="Locales file not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading locales: {str(e)}")

@router.post("/locales")
async def update_locales(locales_data: Dict[str, Any] = Body(...)):
    path = _locales_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(locales_data, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "Locales updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating locales: {str(e)}")
