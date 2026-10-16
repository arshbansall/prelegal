# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user carries out AI chat in order to establish what document they want and how to fill in the fields (built for every document in the catalog).
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

This is the architecture, and it is fully in place (see Implementation status).

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

## Implementation status (as of 2026-10-17)

Done:
- **PL-6:** `templates/` holds the Common Paper agreement templates (CC BY 4.0) with `templates/LICENSE.txt`; `catalog.json` indexes them.
- **PL-7:** Mutual NDA creator at `/`. Form → live preview → PDF generated in the browser (`@react-pdf/renderer`). It reads the two Mutual NDA templates from `../templates` at build time. Logic is in `frontend/src/lib/nda.ts`. (Generalized to every agreement in PL-10.)
- **PL-8:** V1 foundation.
  - `backend/`: FastAPI + SQLAlchemy over SQLite (Python 3.13, uv). The database is recreated on every startup and has a `users` table. Endpoints: `GET /api/health` and `POST /api/auth/login`. All other paths serve `frontend/out`.
  - PL-8's placeholder sign-in was replaced by real accounts in PL-11. Pages in `frontend/src/app/(app)/` require sign-in (checked in the browser) and share the app shell.
  - `Dockerfile` (one container on :8000, non-root, `.env` passed at runtime) and the `scripts/` start/stop scripts. Stopping removes the container, so each start has a fresh database.
- **PL-9:** AI chat fills in the Mutual NDA. The left panel of `/` has a Chat tab (default) and a Fields tab (the PL-7 form, still editable); the preview and PDF are unchanged.
  - `POST /api/chat` is stateless: the browser sends the conversation, the current NDA values and its local date, and gets back `{reply, updates, complete}`. `updates` holds only the changed fields; the server computes `complete` from the required fields. The chat lives in memory only.
  - `backend/app/llm.py` is the only module that calls the LLM (`structured_completion`, raising `LLMUnavailable` → 503 or `LLMError` → 502). Since PL-10 the prompt and turn logic are in `backend/app/drafting.py`, and `nda_chat.py` keeps only the NDA's fields and required-field rules; the request/response and Structured Outputs base models are in `schemas.py`. `OPENROUTER_API_KEY` is read by `Settings` from the environment or the repo's `.env`.
  - Frontend: `components/ui/Tabs.tsx`, `lib/chat.ts`; `applyNdaUpdates` in `lib/nda.ts`. The chat components were generalized in PL-10.
- **PL-10** (merged to `main`, PR #8): Every agreement in `catalog.json` can be drafted, and the page no longer scrolls as a whole.
  - `documents.json` (repo root) defines each agreement: id, names, templates, party roles, whether it has governing law, and its key `terms`. The backend loads it at startup (`app/documents.py`; `PRELEGAL_DOCUMENTS_PATH` in Docker) and the frontend reads it at build time (`readDocuments` in `lib/templates.ts`). Tests keep it consistent with `catalog.json` and with the variables each template highlights.
  - The Mutual NDA keeps its typed fields and Common Paper's own cover page (`nda_chat.py`, `lib/nda.ts`, `NdaForm`). The others get a generated cover page (`buildCoverPage` in `lib/documents.ts`) and a form generated from their terms (`AgreementForm`).
  - Values: one `DocumentValues` = the NDA fields + `terms` (by key) for the other agreements. The parties, effective date, governing law and jurisdiction are shared and carried over when switching agreements (`switchDocument` in `lib/documents.ts`, `switch_document` in `drafting.py`).
  - `POST /api/chat` takes `{messages, documentId (null until chosen), values, today}` and returns `{reply, documentId, updates, complete}`. `app/drafting.py` builds the prompt and runs the turn: with no document, a `SelectionTurn` asks what the user needs or picks one; every turn model has `documentId` first, and when it names a different agreement the turn is re-run for that agreement (at most 2 LLM calls). Unsupported requests get the closest supported agreement offered. Per-agreement Structured Outputs models are generated in `agreement_chat.py`.
  - Frontend: `DocumentCreator` (page state and layout), `DocumentChat` + `useDocumentChat`, `DocumentPicker` (menu, plus cards before anything is chosen), `DocumentPreview`, `AgreementPdf` (numbers nested clauses 1.1, 1.2).
  - Layout: the app shell is exactly the viewport's height; the chat (input pinned at the bottom), the Fields tab and the preview each scroll on their own. Below `lg` an Edit | Preview switch shows one panel at a time.

- **PL-11:** Accounts, saved documents, a landing page and a disclaimer.
  - Auth (`backend/app/auth.py`): passwords hashed with stdlib scrypt; sign-up and sign-in issue an opaque bearer token, and only its SHA-256 is stored in the `sessions` table. `POST /api/auth/signup` (409 for a taken email), `POST /api/auth/login` (one 401 for an unknown email or a wrong password), `GET /api/auth/me`, `POST /api/auth/logout`. Routes that need a user take `CurrentUser`; `/api/chat` and `/api/documents` do. Sessions end when the server restarts (the database is recreated).
  - Saved documents (`routers/saved_documents.py`, `SavedDocument` model, at `/api/documents`; not the catalog in `app/documents.py`): list, create, get, replace, delete. Each stores the agreement id, `DocumentValues`, the chat messages and `dateEdited`; the title comes from the parties' companies. Another user's document is a 404.
  - Frontend session: `lib/session.ts` keeps `{token, user}` in localStorage (`prelegal.session`). `apiFetch` sends `Authorization: Bearer` and clears the session on a 401 (except from login/signup), which sends the user to `/login/`. `RequireAuth` checks the token with `/api/auth/me` once per page load.
  - Routes: `/` is the public landing page; `/login/` and `/signup/` share `AuthForm`; `/draft/` drafts a new document and `/draft/?id=N` resumes a saved one (`DraftPage`, inside `Suspense` for `useSearchParams`); `/documents/` lists saved documents (`DocumentList`). The first save of a new draft puts its id in the URL with `history.replaceState`, without remounting the page.
  - Saving is explicit: Save in the drafting toolbar (Download PDF also saves). `useSaveDocument` serializes saves and tracks unsaved changes with `saveKey` (`lib/savedDocuments.ts`). Leaving a draft with unsaved changes asks first: in-app links and Sign out through `lib/unsavedChanges.ts`, reloads and closing the tab through `beforeunload`.
  - Disclaimer: one text in `lib/disclaimer.ts`, shown above the preview, on every PDF page, and on the landing, auth and documents pages.
  - UI building blocks: `components/ui/layout.tsx` (Card, Callout, PageHeader, EmptyState, Spinner, PageSpinner, Skeleton), `components/ui/icons.tsx`, and `buttonClass` plus secondary/danger variants in `fields.tsx`.

Commands:
- Run: `scripts/start-mac.sh` / `scripts/stop-mac.sh` (or the Linux/Windows versions) → http://localhost:8000
- Dev: `cd backend && uv run uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev` (proxies `/api` to :8000)
- Tests: `cd backend && uv run pytest` (`uv run pytest -m live` also calls the real LLM; needs the key); `cd frontend && npm test`, `npm run lint`, `npm run build`

Conventions:
- New API routes go in `backend/app/routers/` under the `/api` prefix; new models go in `backend/app/models.py`. Call LLMs through `backend/app/llm.py`, and mock `app.llm.completion` in tests.
- New signed-in pages go in `frontend/src/app/(app)/`; public pages go directly in `frontend/src/app/`. Call the API through `frontend/src/lib/api.ts` with relative `/api/...` paths. Shared form controls are in `frontend/src/components/ui/fields.tsx` and page building blocks in `components/ui/layout.tsx`.
- Backend tests that need a user use the `auth_client` fixture or the helpers in `backend/tests/accounts.py`.
- To add an agreement: put its template in `templates/`, list it in `catalog.json`, and add an entry to `documents.json` whose `terms` cover every variable the template highlights (`backend/tests/test_documents.py` checks this). Agreements without a cover page template get a generated one, a form and a Structured Outputs model automatically.
- `frontend/` is Next.js 16: read `frontend/AGENTS.md` and the bundled docs before changing it. Static export means no server components that need a request, no route handlers or server actions, and no middleware.
