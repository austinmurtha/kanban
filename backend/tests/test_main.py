from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def test_root_returns_html(tmp_path: Path) -> None:
  static_dir = tmp_path / "out"
  static_dir.mkdir()
  (static_dir / "index.html").write_text(
    "<!doctype html><html><body><h1>Kanban Studio</h1></body></html>",
    encoding="utf-8",
  )

  client = TestClient(create_app(static_dir=static_dir))
  response = client.get("/")
  assert response.status_code == 200
  assert "text/html" in response.headers["content-type"]
  assert "Kanban Studio" in response.text


def test_static_assets_are_served(tmp_path: Path) -> None:
  static_dir = tmp_path / "out"
  static_dir.mkdir()
  (static_dir / "index.html").write_text(
    "<!doctype html><html><body>app</body></html>", encoding="utf-8"
  )
  (static_dir / "asset.js").write_text("console.log('ok');", encoding="utf-8")

  client = TestClient(create_app(static_dir=static_dir))
  response = client.get("/asset.js")
  assert response.status_code == 200
  assert "console.log('ok');" in response.text


def test_health_endpoint() -> None:
  client = TestClient(create_app())
  response = client.get("/api/health")
  assert response.status_code == 200
  assert response.json() == {"status": "ok"}


def test_hello_endpoint() -> None:
  client = TestClient(create_app())
  response = client.get("/api/hello")
  assert response.status_code == 200
  assert response.json() == {"message": "Hello from FastAPI API"}
