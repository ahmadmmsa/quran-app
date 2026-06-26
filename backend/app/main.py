from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from backend.app.api.router import api_router
from backend.app.session import engine
from backend.app.config import get_settings


settings = get_settings()
allowed_origins = (
    ["*"]
    if settings.cors_origins == "*"
    else [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
)

app = FastAPI(
    title=settings.app_name,
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)

@app.get("/health")
def healthcheck() -> dict:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}

frontend_path = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_path.exists() and frontend_path.is_dir():
    app.mount("/assets", StaticFiles(directory=frontend_path / "assets"), name="assets")
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = frontend_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"error": "Frontend not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.app_host, port=settings.app_port)