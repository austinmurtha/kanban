## Backend Agent Guide

This folder contains the FastAPI backend for the project.

### Current scope (Step 2 scaffolding)

- Entry point: `app/main.py`
- Routes:
  - `GET /` serves a static hello-world HTML page
  - `GET /api/health` returns health JSON
  - `GET /api/hello` returns sample API JSON
- Tests: `tests/test_main.py` validates page and API routes.

### Working conventions

- Keep backend implementation simple and readable.
- Add backend tests for new routes before wiring frontend behavior.
- Keep API responses JSON and predictable for frontend integration.