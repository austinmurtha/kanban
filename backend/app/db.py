import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.board import BoardState, INITIAL_BOARD_STATE


def _utc_now_iso() -> str:
  return datetime.now(UTC).isoformat()


def connect_db(db_path: Path) -> sqlite3.Connection:
  db_path.parent.mkdir(parents=True, exist_ok=True)
  connection = sqlite3.connect(db_path, check_same_thread=False)
  connection.row_factory = sqlite3.Row
  connection.execute("PRAGMA foreign_keys = ON")
  connection.execute("PRAGMA journal_mode=WAL")
  return connection


def init_db(connection: sqlite3.Connection) -> None:
  connection.executescript(
    """
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      board_state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """
  )
  connection.commit()


def _ensure_user(connection: sqlite3.Connection, username: str) -> int:
  now = _utc_now_iso()
  connection.execute(
    "INSERT OR IGNORE INTO users (username, created_at, updated_at) VALUES (?, ?, ?)",
    (username, now, now),
  )
  connection.commit()
  row = connection.execute(
    "SELECT id FROM users WHERE username = ?", (username,)
  ).fetchone()
  return int(row["id"])


def get_or_create_board(connection: sqlite3.Connection, username: str) -> BoardState:
  user_id = _ensure_user(connection, username)

  board_row = connection.execute(
    "SELECT board_state_json FROM boards WHERE user_id = ?", (user_id,)
  ).fetchone()
  if board_row:
    return BoardState.model_validate_json(str(board_row["board_state_json"]))

  now = _utc_now_iso()
  board_state_json = INITIAL_BOARD_STATE.model_dump_json()
  connection.execute(
    """
    INSERT INTO boards (user_id, name, board_state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    """,
    (user_id, "Main Board", board_state_json, now, now),
  )
  connection.commit()
  return INITIAL_BOARD_STATE.model_copy(deep=True)


def update_board(
  connection: sqlite3.Connection, username: str, board_state: BoardState
) -> BoardState:
  user_id = _ensure_user(connection, username)
  now = _utc_now_iso()
  payload = json.dumps(board_state.model_dump())
  connection.execute(
    """
    INSERT INTO boards (user_id, name, board_state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      board_state_json = excluded.board_state_json,
      updated_at = excluded.updated_at
    """,
    (user_id, "Main Board", payload, now, now),
  )
  connection.commit()
  return board_state
