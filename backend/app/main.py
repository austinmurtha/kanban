import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import FileResponse, HTMLResponse

from app.ai import AIClientError, OpenRouterClient, create_openrouter_client
from app.board import BoardState
from app.db import connect_db, get_or_create_board, init_db, update_board


class AITestRequest(BaseModel):
  prompt: str = "2+2"


class AITestResponse(BaseModel):
  model: str
  prompt: str
  response: str


def create_app(
  static_dir: Path | None = None,
  db_path: Path | None = None,
  ai_client: OpenRouterClient | None = None,
) -> FastAPI:
  resolved_db_path = db_path or Path(os.getenv("DATABASE_PATH", "/app/data/pm.db"))

  @asynccontextmanager
  async def lifespan(app: FastAPI):
    connection = connect_db(resolved_db_path)
    init_db(connection)
    app.state.db = connection
    app.state.ai_client = ai_client or create_openrouter_client()
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

  @app.post("/api/ai/test", response_model=AITestResponse)
  def test_ai_connectivity(request: AITestRequest) -> AITestResponse:
    try:
      response_text = app.state.ai_client.chat(request.prompt)
    except AIClientError as exc:
      raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AITestResponse(
      model=app.state.ai_client.model,
      prompt=request.prompt,
      response=response_text,
    )

  resolved_static_dir = static_dir or Path(
    os.getenv("FRONTEND_STATIC_DIR", "/app/frontend/out")
  )

  if resolved_static_dir.exists():
    resolved_static_dir = resolved_static_dir.resolve()
    index_file = resolved_static_dir / "index.html"

    @app.get("/", include_in_schema=False)
    def read_root() -> FileResponse:
      return FileResponse(index_file)

    @app.get("/{resource_path:path}", include_in_schema=False)
    def read_spa_resource(resource_path: str) -> FileResponse:
      if resource_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

      target_path = (resolved_static_dir / resource_path).resolve()
      if (
        target_path.is_file()
        and target_path.is_relative_to(resolved_static_dir)
      ):
        return FileResponse(target_path)
      return FileResponse(index_file)
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
