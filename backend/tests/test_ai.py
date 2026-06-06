from pathlib import Path
import asyncio
import sys
import json

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.ai import AIClientError, OpenRouterClient
from app.main import AIModelResponse, create_app


def test_openrouter_client_success_parses_text() -> None:
  def handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/api/v1/chat/completions"
    return httpx.Response(
      200,
      json={
        "choices": [
          {
            "message": {
              "content": "4",
            }
          }
        ]
      },
    )

  client = OpenRouterClient(
    api_key="test-key",
    http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
  )
  assert asyncio.run(client.chat("2+2")) == "4"
  asyncio.run(client.http_client.aclose())


def test_openrouter_client_http_error() -> None:
  def handler(_: httpx.Request) -> httpx.Response:
    return httpx.Response(500, json={"error": "failure"})

  client = OpenRouterClient(
    api_key="test-key",
    http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
  )
  with pytest.raises(AIClientError):
    asyncio.run(client.chat("2+2"))
  asyncio.run(client.http_client.aclose())


def test_ai_test_endpoint_success(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    async def chat(self, prompt: str) -> str:
      assert prompt == "2+2"
      return "4"

  with TestClient(
    create_app(
      db_path=tmp_path / "pm.db",
      ai_client=FakeAIClient(),  # type: ignore[arg-type]
    )
  ) as client:
    response = client.post("/api/ai/test", json={"prompt": "2+2"})

  assert response.status_code == 200
  assert response.json()["response"] == "4"


def test_ai_test_endpoint_failure(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    async def chat(self, _: str) -> str:
      raise AIClientError("OpenRouter request timed out.")

  with TestClient(
    create_app(
      db_path=tmp_path / "pm.db",
      ai_client=FakeAIClient(),  # type: ignore[arg-type]
    )
  ) as client:
    response = client.post("/api/ai/test", json={"prompt": "2+2"})

  assert response.status_code == 502
  assert response.json()["detail"] == "OpenRouter request timed out."


def test_ai_model_response_rejects_invalid_board_update_shape() -> None:
  with pytest.raises(ValidationError):
    AIModelResponse.model_validate(
      {
        "assistant_message": "Applying update",
        "board_update": {
          "columns": [{"id": "col-a", "title": "A", "cardIds": ["missing-card"]}],
          "cards": {},
        },
      }
    )


def test_ai_chat_message_only_response(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    async def chat(self, prompt: str) -> str:
      return prompt

    async def chat_messages(
      self,
      messages: list[dict[str, str]],
      response_format: dict[str, object] | None = None,
    ) -> str:
      assert response_format is not None
      model_payload = json.loads(messages[1]["content"])
      assert model_payload["user_message"] == "Summarize this board"
      assert model_payload["conversation_history"] == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"},
      ]
      return json.dumps(
        {
          "assistant_message": "No changes needed.",
          "board_update": None,
        }
      )

  with TestClient(
    create_app(
      db_path=tmp_path / "pm.db",
      ai_client=FakeAIClient(),  # type: ignore[arg-type]
    )
  ) as client:
    response = client.post(
      "/api/ai/chat/user",
      json={
        "message": "Summarize this board",
        "history": [
          {"role": "user", "content": "hello"},
          {"role": "assistant", "content": "hi"},
        ],
      },
    )

  assert response.status_code == 200
  assert response.json() == {
    "assistant_message": "No changes needed.",
    "board_update": None,
  }


def test_ai_chat_valid_board_update_persists(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    async def chat(self, prompt: str) -> str:
      return prompt

    async def chat_messages(
      self,
      messages: list[dict[str, str]],
      response_format: dict[str, object] | None = None,
    ) -> str:
      model_payload = json.loads(messages[1]["content"])
      board = model_payload["current_board"]
      board["columns"][0]["title"] = "AI Prioritized"
      return json.dumps(
        {
          "assistant_message": "I renamed the first column.",
          "board_update": board,
        }
      )

  with TestClient(
    create_app(
      db_path=tmp_path / "pm.db",
      ai_client=FakeAIClient(),  # type: ignore[arg-type]
    )
  ) as client:
    chat_response = client.post(
      "/api/ai/chat/user",
      json={"message": "Rename first column", "history": []},
    )
    board_response = client.get("/api/board/user")

  assert chat_response.status_code == 200
  assert chat_response.json()["board_update"]["columns"][0]["title"] == "AI Prioritized"
  assert board_response.status_code == 200
  assert board_response.json()["columns"][0]["title"] == "AI Prioritized"


def test_ai_chat_invalid_schema_returns_safe_fallback(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    async def chat(self, prompt: str) -> str:
      return prompt

    async def chat_messages(
      self,
      messages: list[dict[str, str]],
      response_format: dict[str, object] | None = None,
    ) -> str:
      return '{"assistant_message": 42, "board_update": {"bad": "shape"}}'

  with TestClient(
    create_app(
      db_path=tmp_path / "pm.db",
      ai_client=FakeAIClient(),  # type: ignore[arg-type]
    )
  ) as client:
    response = client.post(
      "/api/ai/chat/user",
      json={"message": "Do something", "history": []},
    )

  assert response.status_code == 200
  assert response.json() == {
    "assistant_message": (
      "I could not apply an AI update safely this time, but your board is unchanged. "
      "Please try your request again."
    ),
    "board_update": None,
  }
