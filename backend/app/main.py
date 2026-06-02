import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.board import BoardState
from app.db import connect_db, get_or_create_board, init_db, update_board


class SPAStaticFiles(StaticFiles):
  async def get_response(self, path: str, scope):
    try:
      return await super().get_response(path, scope)
    except StarletteHTTPException as exc:
      if exc.status_code != 404:
        raise exc
      return await super().get_response("index.html", scope)


def create_app(static_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
  resolved_db_path = db_path or Path(os.getenv("DATABASE_PATH", "/app/data/pm.db"))

  @asynccontextmanager
  async def lifespan(app: FastAPI):
    connection = connect_db(resolved_db_path)
    init_db(connection)
    app.state.db = connection
    try:
      yield
    finally:
      connection.close()

  app = FastAPI(title="PM MVP Backend", lifespan=lifespan)

  @app.get("/api/health")
  def health() -> dict[str, str]:
    return {"status": "ok"}


  @app.get("/api/hello")
  def hello() -> dict[str, str]:
    return {"message": "Hello from FastAPI API"}

  @app.get("/api/board/{username}", response_model=BoardState)
  def read_board(username: str) -> BoardState:
    return get_or_create_board(app.state.db, username)

  @app.put("/api/board/{username}", response_model=BoardState)
  def write_board(username: str, board_state: BoardState) -> BoardState:
    return update_board(app.state.db, username, board_state)

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
