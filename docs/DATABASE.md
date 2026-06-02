# Database Design (Part 5)

This document defines the MVP persistence model for the Kanban board.

## Decision Summary

- Database: SQLite
- Scope: one board per user for MVP
- Storage style: board state stored as JSON text in `boards.board_state_json`
- Reason: fastest path to reliable persistence with a clean migration path later

## Schema (MVP)

### `users`

- `id` INTEGER PRIMARY KEY
- `username` TEXT NOT NULL UNIQUE
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

### `boards`

- `id` INTEGER PRIMARY KEY
- `user_id` INTEGER NOT NULL UNIQUE
- `name` TEXT NOT NULL
- `board_state_json` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

`user_id` is `UNIQUE` to enforce "one board per user" for MVP.

## SQL DDL (Reference)

```sql
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
```

## Board JSON Shape

`board_state_json` stores this payload:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    }
  }
}
```

### JSON Validation Rules

- `columns` must be an array.
- Each column requires `id`, `title`, and `cardIds`.
- `cards` must be an object keyed by card ID.
- Each card requires `id`, `title`, and `details`.
- Every `cardIds` entry must reference a key present in `cards`.

## Read/Write Contract (for Part 6)

- Read: backend returns parsed `board_state_json` as structured JSON.
- Write: backend validates incoming payload shape, then stores serialized JSON text.
- Invalid payloads return validation errors and are not persisted.

## Migration Path (Post-MVP)

If query needs grow (reporting, filtering, analytics), migrate to normalized tables:

- `columns` table (`id`, `board_id`, `title`, `position`)
- `cards` table (`id`, `board_id`, `title`, `details`, `column_id`, `position`)

Migration strategy:

1. Keep writing canonical JSON in `boards.board_state_json`.
2. Backfill normalized tables from existing JSON.
3. Dual-write (JSON + normalized) behind backend service.
4. Switch reads to normalized tables when parity is proven.
5. Optionally deprecate JSON canonical field later.

## Seed Data for MVP Login

- Seed user: `username = "user"`
- On first login/use, create board row if missing and populate with initial board JSON.
