# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user carries out AI chat in order to establish what document they want and how to fill in the fields (built for the Mutual NDA only so far).
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

See Implementation status at the end of this file for what is built so far.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

This is the target architecture. It is in place except real sign up and sign in (see Implementation status).

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
The frontend is statically built (Next.js `output: "export"`) and served by FastAPI.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

These are Tailwind theme tokens in `frontend/src/app/globals.css`: `accent`, `primary`, `secondary`, `navy`, `muted` (e.g. `bg-secondary`, `text-navy`). Blue and gray are below 4.5:1 contrast on white, so use them for accents and borders, not body text.

## Implementation status (as of 2026-10-16)

Done:
- **PL-6:** `templates/` holds the Common Paper agreement templates (CC BY 4.0) with `templates/LICENSE.txt`; `catalog.json` indexes them.
- **PL-7:** Mutual NDA creator at `/`. Form → live preview → PDF generated in the browser (`@react-pdf/renderer`). It reads the two Mutual NDA templates from `../templates` at build time. Logic is in `frontend/src/lib/nda.ts`.
- **PL-8:** V1 foundation.
  - `backend/`: FastAPI + SQLAlchemy over SQLite (Python 3.13, uv). The database is recreated on every startup and has a `users` table. Endpoints: `GET /api/health` and `POST /api/auth/login`. All other paths serve `frontend/out`.
  - Sign-in is a placeholder: any password is accepted and the user is created on first sign-in. The browser keeps `{id, email}` in localStorage. Pages in `frontend/src/app/(app)/` require sign-in (checked in the browser) and share the app shell; `/login/` is the sign-in page.
  - `Dockerfile` (one container on :8000, non-root, `.env` passed at runtime) and the `scripts/` start/stop scripts. Stopping removes the container, so each start has a fresh database.
- **PL-9:** AI chat fills in the Mutual NDA. The left panel of `/` has a Chat tab (default) and a Fields tab (the PL-7 form, still editable); the preview and PDF are unchanged.
  - `POST /api/chat` is stateless: the browser sends the conversation, the current NDA values and its local date, and gets back `{reply, updates, complete}`. `updates` holds only the changed fields; the server computes `complete` from the required fields. The chat lives in memory only.
  - `backend/app/llm.py` is the only module that calls the LLM (`structured_completion`, raising `LLMUnavailable` → 503 or `LLMError` → 502). `backend/app/nda_chat.py` has the system prompt and the required fields; the request/response and Structured Outputs models are in `schemas.py`. `OPENROUTER_API_KEY` is read by `Settings` from the environment or the repo's `.env`.
  - Frontend: `components/useNdaChat.ts` (chat state), `components/NdaChat.tsx`, `components/ui/Tabs.tsx`, `lib/chat.ts`; `applyNdaUpdates` in `lib/nda.ts`.

Not built yet: real sign up and sign in, document persistence, and the other agreement types (including choosing the document in chat).

Commands:
- Run: `scripts/start-mac.sh` / `scripts/stop-mac.sh` (or the Linux/Windows versions) → http://localhost:8000
- Dev: `cd backend && uv run uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev` (proxies `/api` to :8000)
- Tests: `cd backend && uv run pytest` (`uv run pytest -m live` also calls the real LLM; needs the key); `cd frontend && npm test`, `npm run lint`, `npm run build`

Conventions:
- New API routes go in `backend/app/routers/` under the `/api` prefix; new models go in `backend/app/models.py`. Call LLMs through `backend/app/llm.py`, and mock `app.llm.completion` in tests.
- New signed-in pages go in `frontend/src/app/(app)/`. Call the API through `frontend/src/lib/api.ts` with relative `/api/...` paths. Shared form controls are in `frontend/src/components/ui/fields.tsx`.
- `frontend/` is Next.js 16: read `frontend/AGENTS.md` and the bundled docs before changing it. Static export means no server components that need a request, no route handlers or server actions, and no middleware.
