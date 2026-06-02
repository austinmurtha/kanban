from pathlib import Path
import sys

import httpx
from fastapi.testclient import TestClient
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.ai import AIClientError, OpenRouterClient
from app.main import create_app


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
    http_client=httpx.Client(transport=httpx.MockTransport(handler)),
  )
  assert client.chat("2+2") == "4"
  client.http_client.close()


def test_openrouter_client_http_error() -> None:
  def handler(_: httpx.Request) -> httpx.Response:
    return httpx.Response(500, json={"error": "failure"})

  client = OpenRouterClient(
    api_key="test-key",
    http_client=httpx.Client(transport=httpx.MockTransport(handler)),
  )
  with pytest.raises(AIClientError):
    client.chat("2+2")
  client.http_client.close()


def test_ai_test_endpoint_success(tmp_path: Path) -> None:
  class FakeAIClient:
    model = "openrouter/free"

    def chat(self, prompt: str) -> str:
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

    def chat(self, _: str) -> str:
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
