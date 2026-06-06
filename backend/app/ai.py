import os
from dataclasses import dataclass
from typing import Any

import httpx


class AIClientError(Exception):
  pass


@dataclass
class OpenRouterClient:
  api_key: str | None
  model: str = "openrouter/free"
  base_url: str = "https://openrouter.ai/api/v1"
  timeout_seconds: float = 20.0
  app_name: str = "pm-mvp"
  app_url: str = "http://localhost:8000"
  http_client: httpx.AsyncClient | None = None

  async def chat(self, prompt: str) -> str:
    return await self.chat_messages([{"role": "user", "content": prompt}])

  async def chat_messages(
    self,
    messages: list[dict[str, str]],
    response_format: dict[str, Any] | None = None,
  ) -> str:
    if not self.api_key:
      raise AIClientError("OPENROUTER_API_KEY is missing.")

    payload = {
      "model": self.model,
      "messages": messages,
    }
    if response_format is not None:
      payload["response_format"] = response_format

    headers = {
      "Authorization": f"Bearer {self.api_key}",
      "Content-Type": "application/json",
      "HTTP-Referer": self.app_url,
      "X-Title": self.app_name,
    }

    close_client = False
    client = self.http_client
    if client is None:
      client = httpx.AsyncClient(timeout=self.timeout_seconds)
      close_client = True

    try:
      response = await client.post(
        f"{self.base_url}/chat/completions",
        headers=headers,
        json=payload,
      )
      response.raise_for_status()
      data = response.json()
      content = data["choices"][0]["message"]["content"]
      if isinstance(content, str):
        return content.strip()
      if isinstance(content, list):
        text_parts = [
          part.get("text", "")
          for part in content
          if isinstance(part, dict) and part.get("type") == "text"
        ]
        return "".join(text_parts).strip()
      raise AIClientError("Unexpected AI response format.")
    except httpx.TimeoutException as exc:
      raise AIClientError("OpenRouter request timed out.") from exc
    except httpx.HTTPStatusError as exc:
      raise AIClientError(
        f"OpenRouter request failed with status {exc.response.status_code}."
      ) from exc
    except httpx.RequestError as exc:
      raise AIClientError("OpenRouter request failed due to network error.") from exc
    except (KeyError, IndexError, TypeError) as exc:
      raise AIClientError("Failed to parse AI response.") from exc
    finally:
      if close_client:
        await client.aclose()


def create_openrouter_client() -> OpenRouterClient:
  return OpenRouterClient(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model=os.getenv("OPENROUTER_MODEL", "openrouter/free"),
    timeout_seconds=float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "20")),
    app_name="pm-mvp",
    app_url=os.getenv("APP_BASE_URL", "http://localhost:8000"),
  )
