# Frontend Agent Guide

This document describes the current `frontend/` app and how to work on it safely.

## What this frontend is

- Framework: Next.js App Router (`next` 16), React 19, TypeScript.
- Styling: Tailwind CSS v4 plus CSS variables in `src/app/globals.css`.
- Core UI: single-page Kanban board rendered at `/`.
- State model: board state is loaded/saved through backend API routes.
- Drag and drop: `@dnd-kit` libraries.

## Directory map

- `src/app/page.tsx`: home route, renders `KanbanBoard`.
- `src/components/`: Kanban UI components.
  - `KanbanBoard.tsx`: top-level board state and handlers.
  - `KanbanColumn.tsx`: column shell, rename input, sortable list, add-card form.
  - `KanbanCard.tsx`: sortable card with delete action.
  - `NewCardForm.tsx`: add-card interaction.
  - `KanbanCardPreview.tsx`: drag overlay preview.
- `src/lib/kanban.ts`: board types, seed data, drag/move logic, ID helper.
- `src/lib/kanban.test.ts`: unit tests for card movement logic.
- `src/components/KanbanBoard.test.tsx`: component/integration tests.
- `tests/kanban.spec.ts`: Playwright end-to-end smoke tests.

## Current behavior

- App shows one board with five columns.
- Auth gate supports sign-in and local sign-up (frontend localStorage only for MVP).
- User can rename columns inline.
- User can add and remove cards.
- User can drag cards within and across columns.
- Board updates are persisted through backend board APIs and survive reloads.
- A sidebar AI chat sends prompts and full conversation history to backend.
- Valid AI board updates are applied to UI state immediately.

## Commands

Run from `frontend/`:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`

## Testing expectations

- Prefer adding or updating unit tests when changing `src/lib/kanban.ts`.
- Add component/integration tests for UI behavior changes.
- Keep Playwright tests focused on core user flows (load, add card, drag card).
- End-to-end suite is currently available, but project-level MVP does not require adding new E2E tests for every feature.

## Styling and UX constraints

- Reuse design tokens from `src/app/globals.css`:
  - `--accent-yellow`
  - `--primary-blue`
  - `--secondary-purple`
  - `--navy-dark`
  - `--gray-text`
- Keep visuals clean and minimal; avoid adding settings-heavy UI.

## Implementation guardrails

- Keep components simple and focused; avoid over-engineering.
- Preserve the existing board data shape:
  - `BoardData` with `columns: Column[]` and `cards: Record<string, Card>`.
- If introducing persistence or API calls later, keep UI behavior unchanged first, then swap data source behind stable handlers.
- Use `data-testid` consistently for important interactive elements so tests remain stable.
