import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException


class SPAStaticFiles(StaticFiles):
  async def get_response(self, path: str, scope):
    try:
      return await super().get_response(path, scope)
    except StarletteHTTPException as exc:
      if exc.status_code != 404:
        raise exc
      return await super().get_response("index.html", scope)


def create_app(static_dir: Path | None = None) -> FastAPI:
  app = FastAPI(title="PM MVP Backend")

  @app.get("/api/health")
  def health() -> dict[str, str]:
    return {"status": "ok"}


  @app.get("/api/hello")
  def hello() -> dict[str, str]:
    return {"message": "Hello from FastAPI API"}

  resolved_static_dir = static_dir or Path(
    os.getenv("FRONTEND_STATIC_DIR", "/app/frontend/out")
  )

  if resolved_static_dir.exists():
    app.mount(
      "/",
      SPAStaticFiles(directory=str(resolved_static_dir), html=True),
      name="frontend",
    )
  else:
    @app.get("/", response_class=HTMLResponse)
    def read_root_fallback() -> str:
      return (
        "<!doctype html><html><body><h1>Frontend build not found.</h1>"
        "<p>Build the frontend and mount static files to serve the Kanban app.</p>"
        "</body></html>"
      )

  return app


app = create_app()
