# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A kanban-style project management app. Frontend: Next.js 16 (App Router, static export) + TypeScript + Tailwind CSS v4. Backend: FastAPI + Python + SQLite (no ORM). AI features via OpenRouter.

See also: `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md` for additional conventions.

## Commands

**Frontend** (run from `frontend/`):
- `npm run dev` — local dev server
- `npm run build` — static export to `frontend/out/`
- `npm run lint` — ESLint
- `npm run test:unit` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E tests (auto-starts dev server)

**Backend** (run from `backend/`):
- `uv run pytest` — run backend tests
- `uv sync` — install dependencies

**Docker** (run from project root):
- `./scripts/start-mac.sh` — build and start (`http://localhost:8000`)
- `./scripts/stop-mac.sh` — stop

## Setup

Copy `.env` and set `OPENROUTER_API_KEY`. The app will not start without it.

## Architecture Notes

- Next.js uses `output: "export"` — no SSR or Next.js API routes. The static build is served by FastAPI.
- Auth is localStorage-only. The backend accepts any username string; there is no server-side auth enforcement.
- AI board updates send a complete `BoardState` replacement, not a diff. The `cardIds` in every column must reference valid keys in `cards`.

## Board Data Shape

```
BoardState: { columns: Column[], cards: Record<string, Card> }
Column:     { id, title, cardIds: string[] }
Card:       { id, title, details }
```

All `cardIds` must reference keys that exist in `cards`. This invariant is enforced by a Pydantic validator.

## Code Style

- **Python indentation: 2 spaces** (not the standard 4). This is deliberate — match it consistently.
- No emojis anywhere — not in code, comments, docs, or responses.
- Keep changes minimal and focused. No over-engineering, no extra features, no unnecessary defensive code.
- Frontend design tokens are CSS variables defined in `globals.css`: `var(--accent-yellow)`, `var(--primary-blue)`, `var(--secondary-purple)`, `var(--navy-dark)`, `var(--gray-text)`. Use these — there is no `tailwind.config.*` file (Tailwind v4).
- Use `data-testid` attributes on interactive elements for test stability.
