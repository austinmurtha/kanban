## Backend Agent Guide

This folder contains the FastAPI backend for the project.

### Current scope (Step 2 scaffolding)

- Entry point: `app/main.py`
- Routes:
  - `GET /` serves exported frontend static assets
  - `GET /api/health` returns health JSON
  - `GET /api/hello` returns sample API JSON
  - `GET /api/board/{username}` returns persisted board state
  - `PUT /api/board/{username}` updates persisted board state
  - `POST /api/ai/test` checks OpenRouter connectivity (default prompt `2+2`)
  - `POST /api/ai/chat/{username}` runs structured AI chat and optional board update
- Database:
  - SQLite database initialized on startup
  - Tables: `users`, `boards`
  - Board JSON stored in `boards.board_state_json`
- Tests: `tests/test_main.py` validates static serving, DB init, and board APIs.

### Working conventions

- Keep backend implementation simple and readable.
- Add backend tests for new routes before wiring frontend behavior.
- Keep API responses JSON and predictable for frontend integration.