# Code Review

## Summary

This is a well-structured solo kanban app with a clear separation of concerns, good test coverage for a project of this size, and solid defensive coding patterns (board shape validation, AI fallback responses, cancel tokens on fetch). The main risks are a real API key committed to `.env`, passwords stored in plaintext in localStorage, and a handful of correctness gaps around concurrent saves, card orphaning, and unsafe data access.

---

## Critical Issues

### 1. Real API key committed to `.env`
**File:** `.env:1`  
**Problem:** `OPENROUTER_API_KEY=sk-or-v1-97d4ced...` is a real credential committed to the repository. This is exposed to anyone who can read the repo and will likely be rotated by the provider automatically, but it also means the key is in git history permanently.  
**Fix:** Rotate the key immediately. Replace `.env` contents with placeholder values and add `.env` to `.gitignore`. Use `.env.example` as the committed template.

### 2. Passwords stored in plaintext in localStorage
**File:** `frontend/src/components/LoginGate.tsx:14,40`  
**Problem:** `StoredUser` stores `{ username, password }` and `writeStoredUsers` serialises the password directly to `localStorage`. Any JavaScript running on the page (XSS, browser extension) can read all passwords with one `localStorage.getItem("pm-users")` call. The hardcoded `DUMMY_PASSWORD = "password"` is also in plaintext.  
**Fix:** For a local-only auth system, store a `bcrypt`/`scrypt` hash of the password in localStorage (use the Web Crypto API: `crypto.subtle.digest("SHA-256", ...)` at minimum). The dummy credentials should also be removed from the UI hint text since they reveal the master password.

### 3. AI board update bypasses all size/column-count constraints
**File:** `backend/app/main.py:198-205`  
**Problem:** The AI can return a `board_update` with any number of columns (0, 100) and any card content. `BoardState.validate_card_references` only checks that `cardIds` reference real cards — it does not enforce a column count, non-empty titles, non-empty card IDs, or maximum lengths. A malformed AI response accepted by Pydantic can replace the entire board with a degenerate state (e.g. zero columns).  
**Fix:** Add constraints to `BoardState` and `Card`/`Column` models: `@field_validator` for `columns` length (e.g. 1–10), `min_length=1` on `id` and `title` fields, and `max_length` on `title` and `details`.

---

## High Priority

### 4. AI board update is not persisted after `handleSendChat` — save is skipped
**File:** `frontend/src/components/KanbanBoard.tsx:244-247`  
**Problem:** When the AI returns a `board_update`, the code calls `setBoard(response.board_update)` directly, bypassing `updateBoard`. `updateBoard` is the only path that calls `persistBoard` (which calls `saveBoard`). So the AI-applied change is shown in the UI but **is never saved to the backend** via the frontend save path. (The backend does persist the change itself in `ai_chat`, but if the user then makes a manual edit the frontend will PUT the full board overwriting with the AI state — so this actually works incidentally. However if the user reloads before any manual edit, the AI board is reflected because the backend persisted it. The more subtle bug: `setSaveError("")` is called but the board-from-AI is never routed through `persistBoard`, so a future save error from a manual edit will reference a different board version.)  
**Fix:** Replace the direct `setBoard` call with `updateBoard(() => response.board_update)` so the save pipeline is consistent:
```ts
if (response.board_update) {
  updateBoard(() => response.board_update!);
}
```

### 5. Null card lookup silently renders `undefined` in KanbanColumn
**File:** `frontend/src/components/KanbanBoard.tsx:337`  
**Problem:** `column.cardIds.map((cardId) => safeBoard.cards[cardId])` produces `undefined` for any `cardId` not present in `cards`. This is typed as `Card[]` but can contain `undefined` at runtime. `KanbanCard` receives `card={undefined}` and will throw trying to access `card.id`, `card.title`, etc. This can happen if AI sends an inconsistent board (the `BoardState` validator catches it on the backend, but the frontend has no equivalent guard when applying `board_update`).  
**Fix:** Filter out missing cards: `.map((cardId) => safeBoard.cards[cardId]).filter(Boolean)`, or add a type guard. Also validate `board_update` shape on the frontend before calling `setBoard`.

### 6. Race condition: rapid board edits can overwrite each other
**File:** `frontend/src/components/KanbanBoard.tsx:148-160`  
**Problem:** `updateBoard` calls `persistBoard(next)` inside the `setBoard` updater. Multiple rapid edits (e.g. typing in a column title triggers a save on every keystroke) fire concurrent `PUT /api/board/:username` requests. There is no debounce, no request serialisation, and no cancellation. The last-writer-wins at the network level, which may not be the most recent edit.  
**Fix:** Debounce `persistBoard` calls (e.g. 400 ms after the last change) and/or serialise saves with a ref-based queue. At minimum, debounce the column rename `onChange` since it fires on every keypress.

### 7. `_ensure_user` is not atomic — TOCTOU race under concurrent requests
**File:** `backend/app/db.py:45-61`  
**Problem:** `_ensure_user` does a SELECT then INSERT without wrapping both in a transaction. Under concurrent requests for the same new username, two requests can both see no row and both attempt INSERT, causing a `UNIQUE constraint failed` exception that is not caught.  
**Fix:** Wrap both operations in a transaction and use `INSERT OR IGNORE` + re-fetch, or use `INSERT INTO users ... ON CONFLICT(username) DO NOTHING` followed by a SELECT:
```python
connection.execute(
  "INSERT OR IGNORE INTO users (username, created_at, updated_at) VALUES (?, ?, ?)",
  (username, now, now),
)
connection.commit()
row = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
return int(row["id"])
```

### 8. Blocking synchronous HTTP call in a FastAPI async context
**File:** `backend/app/ai.py:54` and `backend/app/main.py:174`  
**Problem:** `OpenRouterClient.chat_messages` uses a synchronous `httpx.Client` and is called directly from FastAPI route functions. Because the route functions are sync (not `async def`), FastAPI runs them in a thread pool, which is correct. However `ai_chat` can hold a thread pool slot for up to 20 seconds (the default timeout), reducing parallelism under load. This is acceptable for a solo app but worth noting.  
**Fix:** Convert `OpenRouterClient` to use `httpx.AsyncClient` and make `ai_chat` an `async def` route. For this scale, acceptable to leave as-is but document the limitation.

---

## Medium Priority

### 9. E2E tests assume the user is already logged in (no auth step)
**File:** `frontend/tests/kanban.spec.ts:3-41`  
**Problem:** All three Playwright tests navigate to `/` and immediately interact with the kanban board, but the app renders a login gate by default. These tests only pass because `localStorage` persists auth state across test runs in the dev server, or because the board is shown without auth in some states. There is no `beforeEach` that seeds auth state, so tests are order-dependent and will fail on a fresh browser context.  
**Fix:** Add a `beforeEach` that sets `pm-authenticated=true` and `pm-auth-username=user` in localStorage before navigating:
```ts
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("pm-authenticated", "true");
    localStorage.setItem("pm-auth-username", "user");
  });
});
```

### 10. `createId` uses `Math.random()` — not collision-safe for bulk AI imports
**File:** `frontend/src/lib/kanban.ts:164-168`  
**Problem:** `Math.random().toString(36).slice(2, 8)` generates ~2 billion possible values (36^6 ≈ 2.18B). For a single user adding cards one at a time this is fine, but if an AI board update creates many cards simultaneously the frontend's `handleAddCard` loop calling `createId` multiple times in the same millisecond has a small but non-zero collision risk. A collision would silently overwrite a card in the `cards` record.  
**Fix:** Use `crypto.randomUUID()` or `crypto.getRandomValues` which is available in all modern browsers and Next.js environments:
```ts
export const createId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
```

### 11. `update_board` does not use a transaction for read-then-write
**File:** `backend/app/db.py:86-115`  
**Problem:** `update_board` does a SELECT to check if a board row exists, then does UPDATE or INSERT outside a transaction. Between the SELECT and the write, another request could insert the board, causing the UPDATE branch to run against a non-existent old row (or vice versa).  
**Fix:** Use `INSERT OR REPLACE` or wrap in `BEGIN ... COMMIT`:
```python
connection.execute("""
  INSERT INTO boards (user_id, name, board_state_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET board_state_json = excluded.board_state_json,
    updated_at = excluded.updated_at
""", (user_id, "Main Board", payload, now, now))
connection.commit()
```

### 12. `check_same_thread=False` on a single shared connection is unsafe
**File:** `backend/app/db.py:15`  
**Problem:** `sqlite3.connect(db_path, check_same_thread=False)` disables SQLite's thread safety check and shares one connection across all FastAPI worker threads. SQLite's built-in serialization only protects against data corruption, not against interleaved operations from multiple threads producing incorrect results (e.g. the TOCTOU in `_ensure_user`). For a solo-user app the risk is low, but it's a latent bug.  
**Fix:** Use a connection pool (one connection per thread via `threading.local`) or switch to `aiosqlite` for async-safe access. Minimum fix: use `sqlite3.connect` with WAL mode and ensure all writes go through a single-threaded executor.

### 13. Missing `pydantic` in backend dependencies
**File:** `backend/pyproject.toml:8`  
**Problem:** `pydantic` is used extensively in `board.py` and `main.py` but is not listed as a dependency in `pyproject.toml`. It is available transitively through `fastapi`, but relying on transitive dependencies is fragile — a FastAPI version bump could change what version of Pydantic is pulled in.  
**Fix:** Add `"pydantic>=2.0"` to the `dependencies` list in `pyproject.toml`.

### 14. Chat history grows unboundedly in memory and in the AI request payload
**File:** `frontend/src/components/KanbanBoard.tsx:93,232-233`  
**Problem:** `chatHistory` accumulates every message for the session lifetime. The full history is sent with every chat request (`historySnapshot = chatHistory`). A long session will produce increasingly large payloads, eventually hitting model context limits or the 20-second timeout.  
**Fix:** Cap the history sent to the API at the last N turns (e.g. last 10 messages):
```ts
const historySnapshot = chatHistory.slice(-10);
```
Display the full history in the UI but send only the tail to the API.

### 15. `get_or_create_board` returns `INITIAL_BOARD_STATE` singleton — mutations would be shared
**File:** `backend/app/db.py:83`  
**Problem:** When creating a new board, `get_or_create_board` returns `INITIAL_BOARD_STATE` directly (the module-level constant). Pydantic v2 models are immutable by default, so this is safe as long as nothing mutates the object. However if model config is ever changed to `model_config = ConfigDict(frozen=False)`, all new users would share the same mutable object.  
**Fix:** Return `INITIAL_BOARD_STATE.model_copy(deep=True)` to make the intent explicit and guard against future mutability changes.

---

## Low Priority

### 16. `chat-message-${message.role}-${index}` key is not stable
**File:** `frontend/src/components/KanbanBoard.tsx:375`  
**Problem:** Using array index as part of the React key means if a message is prepended or removed, React will unnecessarily re-render all subsequent messages. This is cosmetic but can cause scroll position jumps.  
**Fix:** Generate a stable ID per message (e.g. a `crypto.randomUUID()` assigned when the message is added to `chatHistory`), or use a more stable key such as a combination of role and content hash.

### 17. `handleLogout` resets `authenticatedUsername` to `DUMMY_USERNAME` instead of `""`
**File:** `frontend/src/components/LoginGate.tsx:108`  
**Problem:** On logout, `authenticatedUsername` is set back to `DUMMY_USERNAME` ("user"). This is harmless because `isAuthenticated` is false, but if there's ever a code path that reads `authenticatedUsername` without checking `isAuthenticated` first, it would silently fall back to the dummy user's board.  
**Fix:** Set `authenticatedUsername` to `""` on logout and add a guard in `KanbanBoard` to treat an empty username as an error state.

### 18. Static file path traversal protection could be bypassed on Windows
**File:** `backend/app/main.py:225-231`  
**Problem:** `target_path.is_relative_to(resolved_static_dir)` correctly prevents path traversal on Linux/macOS. On Windows, path comparison is case-insensitive at the OS level but `pathlib` may do case-sensitive comparison, potentially allowing `../` traversal via mixed-case paths. The app runs in Docker on Linux, so this is not an active risk, but the code comment should note the assumption.  
**Fix:** Add a comment: `# Safe on Linux/macOS; resolved_static_dir and resolve() normalise symlinks.` No code change needed for the current deployment target.

### 19. `hello` endpoint serves no purpose and should be removed
**File:** `backend/app/main.py:148-150`  
**Problem:** `GET /api/hello` returns `{"message": "Hello from FastAPI API"}` and has a test. This is dead scaffolding code that adds noise to the API surface.  
**Fix:** Remove the endpoint and its test.

### 20. `AI_RESPONSE_FORMAT` schema for `board_update` is too permissive
**File:** `backend/app/main.py:103-120`  
**Problem:** The JSON schema sent to OpenRouter specifies `board_update` as `{"type": ["object", "null"]}` with no subschema. This means the model is not constrained by structured output to produce a valid board shape — it relies on Pydantic validation after the fact. While the fallback handles invalid responses safely, a tighter schema would reduce token waste on malformed responses.  
**Fix:** Inline the full board schema in `AI_RESPONSE_FORMAT` so the model's structured output mode enforces the shape. This is optional given the fallback is solid.

---

## What's Done Well

- **Board shape invariant enforcement**: `BoardState.validate_card_references` in `board.py` is exactly the right place for this check, and `test_put_board_rejects_invalid_card_reference` covers it with a real HTTP test.
- **AI fallback is safe**: The `_fallback_chat_response()` pattern means a bad AI response never crashes the endpoint or corrupts data. The `json.JSONDecodeError | ValidationError` catch is the correct double-guard.
- **Cancellation token on board load**: The `isCancelled` flag in `KanbanBoard`'s `useEffect` correctly prevents stale state from being applied after unmount or username change.
- **Dependency injection for testing**: `create_app(db_path, ai_client)` and the `loadBoard`/`saveBoard`/`sendChat` props on `KanbanBoard` make both backend and frontend tests clean and free of mocking complexity.
- **Pydantic validation on chat history**: `ChatHistoryMessage` with `extra="forbid"` and content validation prevents garbage from reaching the AI prompt.
- **`check_same_thread=False` is intentional and acknowledged**: The single connection pattern is simple and works for single-user SQLite; it just needs the transactional fixes noted above.
- **Drag-and-drop logic is well-tested**: `kanban.test.ts` covers the three meaningful cases (reorder, cross-column move, drop-to-column-end) and `moveCard` handles the edge cases (missing column, same position) by returning the original columns unchanged.
- **Column title rename is immediate and persisted**: The `onChange` → `updateBoard` path is clean, with no intermediate form state to lose.
