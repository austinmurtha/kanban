import os
import json
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
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


class ChatHistoryMessage(BaseModel):
  model_config = ConfigDict(extra="forbid")

  role: Literal["user", "assistant"]
  content: str

  @field_validator("content")
  @classmethod
  def validate_content(cls, value: str) -> str:
    if not value.strip():
      raise ValueError("Message content must not be empty.")
    return value


class AIChatRequest(BaseModel):
  message: str
  history: list[ChatHistoryMessage] = Field(default_factory=list)

  @field_validator("message")
  @classmethod
  def validate_message(cls, value: str) -> str:
    if not value.strip():
      raise ValueError("Message must not be empty.")
    return value


class AIModelResponse(BaseModel):
  model_config = ConfigDict(extra="forbid")

  assistant_message: str
  board_update: BoardState | None = None

  @field_validator("assistant_message")
  @classmethod
  def validate_assistant_message(cls, value: str) -> str:
    if not value.strip():
      raise ValueError("assistant_message must not be empty.")
    return value


class AIChatResponse(BaseModel):
  assistant_message: str
  board_update: BoardState | None = None


def _fallback_chat_response() -> AIChatResponse:
  return AIChatResponse(
    assistant_message=(
      "I could not apply an AI update safely this time, but your board is unchanged. "
      "Please try your request again."
    ),
    board_update=None,
  )


def _build_ai_messages(
  board_state: BoardState,
  request: AIChatRequest,
) -> list[dict[str, str]]:
  system_prompt = (
    "You are the PM MVP Kanban assistant. "
    "Return JSON only with this exact shape: "
    '{"assistant_message":"string","board_update":null|{"columns":[...],"cards":{...}}}. '
    "If no board change is needed, set board_update to null. "
    "If board_update is present, it must be a complete replacement board object and keep cardIds valid."
  )
  user_payload = {
    "current_board": board_state.model_dump(),
    "conversation_history": [item.model_dump() for item in request.history],
    "user_message": request.message,
  }
  return [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": json.dumps(user_payload)},
  ]


AI_RESPONSE_FORMAT = {
  "type": "json_schema",
  "json_schema": {
    "name": "pm_chat_response",
    "strict": True,
    "schema": {
      "type": "object",
      "additionalProperties": False,
      "required": ["assistant_message", "board_update"],
      "properties": {
        "assistant_message": {"type": "string"},
        "board_update": {
          "anyOf": [
            {"type": "null"},
            {
              "type": "object",
              "additionalProperties": False,
              "required": ["columns", "cards"],
              "properties": {
                "columns": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "title", "cardIds"],
                    "properties": {
                      "id": {"type": "string"},
                      "title": {"type": "string"},
                      "cardIds": {
                        "type": "array",
                        "items": {"type": "string"},
                      },
                    },
                  },
                },
                "cards": {
                  "type": "object",
                  "additionalProperties": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "title", "details"],
                    "properties": {
                      "id": {"type": "string"},
                      "title": {"type": "string"},
                      "details": {"type": "string"},
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
}


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


  @app.get("/api/board/{username}", response_model=BoardState)
  def read_board(username: str) -> BoardState:
    return get_or_create_board(app.state.db, username)

  @app.put("/api/board/{username}", response_model=BoardState)
  def write_board(username: str, board_state: BoardState) -> BoardState:
    return update_board(app.state.db, username, board_state)

  @app.post("/api/ai/test", response_model=AITestResponse)
  async def test_ai_connectivity(request: AITestRequest) -> AITestResponse:
    try:
      response_text = await app.state.ai_client.chat(request.prompt)
    except AIClientError as exc:
      raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AITestResponse(
      model=app.state.ai_client.model,
      prompt=request.prompt,
      response=response_text,
    )

  @app.post("/api/ai/chat/{username}", response_model=AIChatResponse)
  async def ai_chat(username: str, request: AIChatRequest) -> AIChatResponse:
    current_board = get_or_create_board(app.state.db, username)
    messages = _build_ai_messages(current_board, request)

    try:
      raw_model_response = await app.state.ai_client.chat_messages(
        messages=messages,
        response_format=AI_RESPONSE_FORMAT,
      )
    except AIClientError:
      return _fallback_chat_response()

    try:
      parsed_payload = json.loads(raw_model_response)
      validated_response = AIModelResponse.model_validate(parsed_payload)
    except (json.JSONDecodeError, ValidationError):
      return _fallback_chat_response()

    if validated_response.board_update is None:
      return AIChatResponse(
        assistant_message=validated_response.assistant_message,
        board_update=None,
      )

    persisted_board = update_board(
      app.state.db,
      username,
      validated_response.board_update,
    )
    return AIChatResponse(
      assistant_message=validated_response.assistant_message,
      board_update=persisted_board,
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
        # resolve() normalises symlinks; safe on Linux/macOS (Docker target).
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
