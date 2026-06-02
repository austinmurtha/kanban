# Project Management MVP

Simple project management app with:

- Next.js frontend (Kanban board + AI sidebar chat)
- FastAPI backend (API + static frontend hosting)
- SQLite persistence
- Dockerized local run

## Local Run

1. Add `OPENROUTER_API_KEY` to `.env` in the project root.
2. Start the app:
   - macOS: `./scripts/start-mac.sh`
   - Linux: `./scripts/start-linux.sh`
   - Windows: `scripts\\start-windows.bat`
3. Open `http://localhost:8000`

Stop the app:

- macOS: `./scripts/stop-mac.sh`
- Linux: `./scripts/stop-linux.sh`
- Windows: `scripts\\stop-windows.bat`

## Auth (MVP)

- Default sign-in: `user` / `password`
- You can also create a local sign-up account from the login screen

## Tests

Frontend:

- `cd frontend && npm run test:unit`

Backend:

- `cd backend && uv run pytest`

## Notes

- This is an MVP intended for local development.
- Current auth is not production-grade.
