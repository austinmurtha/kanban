from pathlib import Path
import sys

from fastapi.testclient import TestClient
import sqlite3

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def test_root_returns_html(tmp_path: Path) -> None:
  static_dir = tmp_path / "out"
  static_dir.mkdir()
  (static_dir / "index.html").write_text(
    "<!doctype html><html><body><h1>Kanban Studio</h1></body></html>",
    encoding="utf-8",
  )

  with TestClient(create_app(static_dir=static_dir, db_path=tmp_path / "pm.db")) as client:
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

  with TestClient(create_app(static_dir=static_dir, db_path=tmp_path / "pm.db")) as client:
    response = client.get("/asset.js")
  assert response.status_code == 200
  assert "console.log('ok');" in response.text


def test_health_endpoint(tmp_path: Path) -> None:
  with TestClient(create_app(db_path=tmp_path / "pm.db")) as client:
    response = client.get("/api/health")
  assert response.status_code == 200
  assert response.json() == {"status": "ok"}



def test_db_is_created_on_startup(tmp_path: Path) -> None:
  db_path = tmp_path / "nested" / "pm.db"
  assert not db_path.exists()

  with TestClient(create_app(db_path=db_path)) as client:
    health_response = client.get("/api/health")
    assert health_response.status_code == 200

  assert db_path.exists()

  connection = sqlite3.connect(db_path)
  try:
    tables = {
      row[0]
      for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      ).fetchall()
    }
  finally:
    connection.close()

  assert "users" in tables
  assert "boards" in tables


def test_get_board_creates_default_board_for_user(tmp_path: Path) -> None:
  with TestClient(create_app(db_path=tmp_path / "pm.db")) as client:
    response = client.get("/api/board/user")
  assert response.status_code == 200
  payload = response.json()
  assert len(payload["columns"]) == 5
  assert "card-1" in payload["cards"]


def test_put_board_updates_board_for_user(tmp_path: Path) -> None:
  with TestClient(create_app(db_path=tmp_path / "pm.db")) as client:
    initial_response = client.get("/api/board/user")
    payload = initial_response.json()
    payload["columns"][0]["title"] = "Prioritized Backlog"
    payload["cards"]["card-1"]["title"] = "Updated card title"

    update_response = client.put("/api/board/user", json=payload)
    assert update_response.status_code == 200
    assert update_response.json()["columns"][0]["title"] == "Prioritized Backlog"

    fetch_response = client.get("/api/board/user")
    assert fetch_response.status_code == 200
    assert fetch_response.json()["columns"][0]["title"] == "Prioritized Backlog"
    assert fetch_response.json()["cards"]["card-1"]["title"] == "Updated card title"


def test_put_board_rejects_invalid_card_reference(tmp_path: Path) -> None:
  invalid_payload = {
    "columns": [{"id": "col-a", "title": "A", "cardIds": ["card-missing"]}],
    "cards": {},
  }

  with TestClient(create_app(db_path=tmp_path / "pm.db")) as client:
    response = client.put("/api/board/user", json=invalid_payload)

  assert response.status_code == 422
