# Project Plan (Detailed)

This document is the execution plan for the MVP described in `AGENTS.md`.

## Agreed Constraints and Decisions

- No end-to-end browser tests for now.
- A frontend-only login gate is acceptable for MVP (not backend-enforced auth yet).
- Recommendation: store each board as JSON in SQLite for simplicity and clean migration later.
- Recommendation: use static Next.js export and serve built assets from FastAPI.
- AI model target: `openai/gpt-oss-120b` via OpenRouter.

## Part 1 - Plan and Repository Orientation

### Checklist
- [x] Confirm user approval of this plan before coding subsequent parts.
- [x] Create `frontend/AGENTS.md` documenting current frontend architecture and conventions.
- [x] Define test strategy by layer (frontend unit/integration, backend unit/integration).
- [x] Define "done" criteria per part and keep this file updated as progress tracker.

### Tests
- [x] Verify `frontend/AGENTS.md` exists and is accurate against current `frontend/` code.
- [x] Verify all parts below include checklist, tests, and success criteria.

### Success Criteria
- Plan is approved by user.
- Team can implement sequentially without ambiguity.

### Status
- Part 1 is complete and approved.
- Next planned execution step is Part 2 (Scaffolding).

## Part 2 - Scaffolding (Docker + FastAPI + Scripts)

### Checklist
- [x] Create `backend/` FastAPI app with health endpoint and sample API endpoint.
- [x] Add Dockerfile and compose config for local single-container run.
- [x] Add `scripts/start` and `scripts/stop` variants for macOS, Linux, and Windows.
- [x] Serve a temporary static hello-world page from FastAPI at `/`.
- [x] Confirm API endpoint can be called from that static page.

### Tests
- [x] Build container successfully.
- [x] Run container via scripts and verify app responds on expected port.
- [x] Assert `/` returns HTML and `/api/health` returns success JSON.
- [x] Add backend tests for health/sample endpoint.

### Success Criteria
- Local dockerized app starts/stops with scripts.
- Browser shows hello-world page and successful API call.

### Status
- Part 2 is complete and validated.
- Backend tests pass in container (`3 passed`).
- macOS scripts were executed; Linux/Windows script execution was explicitly skipped with user approval.

## Part 3 - Integrate Existing Frontend (Static Build + Serve)

### Checklist
- [x] Configure frontend for static export build.
- [x] Build frontend artifacts and copy/serve them via FastAPI static routing.
- [x] Replace temporary hello-world page with Kanban demo at `/`.
- [x] Ensure asset paths and routing work inside container.

### Tests
- [x] Frontend unit tests run and pass.
- [x] Frontend integration tests for main board render and key interactions pass.
- [x] Backend route tests ensure static files are served correctly.

### Success Criteria
- Visiting `/` shows the demo Kanban board served by FastAPI in Docker.
- No regressions in core frontend behavior.

### Status
- Part 3 is complete and validated.
- Frontend tests pass (`6 passed`).
- Backend tests pass in container (`4 passed`).

## Part 4 - Fake Login Experience (Frontend Gate)

### Checklist
- [x] Add login screen for unauthenticated state.
- [x] Validate hardcoded credentials: username `user`, password `password`.
- [x] Persist auth state locally for the session.
- [x] Add logout flow returning user to login screen.
- [x] Gate Kanban UI behind login state in frontend.

### Tests
- [x] Unit tests for login form validation and credential checks.
- [x] Integration tests for login success, login failure, logout behavior.
- [x] Integration tests ensuring Kanban is hidden when logged out.

### Success Criteria
- User must login to see board.
- Logout reliably clears frontend auth state.

### Status
- Part 4 is complete and validated.
- Frontend tests pass (`10 passed`).

## Part 5 - Database Modeling (SQLite + JSON Board State)

### Recommended Schema (MVP)
- `users`: `id`, `username` (unique), timestamps.
- `boards`: `id`, `user_id` (unique per user for MVP), `name`, `board_state_json`, timestamps.

`board_state_json` will store the board columns/cards payload as JSON text.  
This keeps MVP implementation simple while preserving future migration options.

### Checklist
- [ ] Finalize schema in docs and get user sign-off.
- [x] Define JSON shape for board payload (columns, card IDs/order, card content).
- [x] Document migration path to normalized card/column tables if needed later.

### Tests
- [ ] Add schema-level tests for table creation and constraints.
- [ ] Add serialization/deserialization tests for board JSON payload.

### Success Criteria
- Schema is approved and documented.
- Backend can reliably persist and retrieve full board JSON per user.

### Status
- Database proposal documented in `docs/DATABASE.md`.
- Awaiting explicit user sign-off to mark Part 5 complete.

## Part 6 - Backend API for Kanban Persistence

### Checklist
- [ ] Add DB initialization on startup if DB file/tables do not exist.
- [ ] Implement API to fetch board for current user.
- [ ] Implement API to replace/update board JSON for current user.
- [ ] Add request/response models with validation.
- [ ] Add clear error responses for invalid payloads.

### Tests
- [ ] Unit tests for repository/service functions.
- [ ] API integration tests for read/update board routes.
- [ ] Tests for startup initialization creating DB automatically.

### Success Criteria
- Backend persists board updates and returns latest state reliably.
- API contract is validated and tested.

## Part 7 - Frontend + Backend Wiring

### Checklist
- [ ] Replace local frontend board state source with backend API calls.
- [ ] Load board state on login.
- [ ] Save board updates from drag/edit actions.
- [ ] Add loading/error handling for API failures.

### Tests
- [ ] Frontend integration tests with mocked API for load/save flows.
- [ ] Backend integration tests continue passing for persistence routes.
- [ ] Basic manual smoke test in Docker: edit/move cards, refresh, state persists.

### Success Criteria
- Board state is truly persistent via backend.
- User sees consistent board state after refresh/reload.

## Part 8 - AI Connectivity (OpenRouter Baseline)

### Checklist
- [ ] Add backend AI client using `OPENROUTER_API_KEY`.
- [ ] Configure model `openai/gpt-oss-120b`.
- [ ] Add test endpoint or service method for simple prompt check.
- [ ] Implement connectivity guardrails (timeout, error mapping, logging).

### Tests
- [ ] Connectivity test with prompt `2+2` and expected non-empty response.
- [ ] Unit tests for AI client success and failure paths.

### Success Criteria
- Backend can successfully call OpenRouter model from local environment.

## Part 9 - Structured AI Outputs for Chat + Optional Board Update

### Why structured output matters here
Structured outputs force the model to return machine-parseable JSON in a fixed schema.  
This makes board updates safer and deterministic versus parsing free-form text.

### Checklist
- [ ] Define strict response schema:
  - [ ] `assistant_message` (string)
  - [ ] `board_update` (optional object in agreed board JSON shape)
- [ ] Send current board JSON + user message + history to model.
- [ ] Validate model output against schema before applying any update.
- [ ] Reject/ignore invalid updates and return safe fallback response.

### Tests
- [ ] Unit tests for schema validation and fallback handling.
- [ ] Integration tests for:
  - [ ] Message-only replies (no board change)
  - [ ] Valid board updates
  - [ ] Invalid schema output handling

### Success Criteria
- Chat replies are reliable.
- Any board update is schema-valid before persistence.

## Part 10 - Sidebar AI UX + Auto Refresh

### Checklist
- [ ] Add sidebar chat UI styled to project palette.
- [ ] Render conversation history.
- [ ] Send user prompts to backend AI endpoint.
- [ ] Apply returned board updates to UI state and persist through backend.
- [ ] Refresh board view immediately when AI update is accepted.

### Tests
- [ ] Frontend component/integration tests for chat send/receive and loading/error states.
- [ ] Integration test for AI-triggered board update appearing in Kanban UI.
- [ ] Manual smoke test in Docker for full workflow.

### Success Criteria
- User can chat with AI in sidebar.
- AI can optionally modify board and UI reflects changes immediately.

## Execution Order and Gates

- [ ] Complete parts in order from 1 to 10.
- [ ] Pause for user sign-off at planned gates:
  - [x] After Part 1 plan + `frontend/AGENTS.md`
  - [ ] After Part 5 schema documentation
  - [ ] Before enabling AI-driven board mutations in Part 9