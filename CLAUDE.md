# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

## Current state

The project is an early prototype. What exists today:

- `templates/` and `catalog.json`: the Common Paper agreement templates (CC BY 4.0) imported in PL-6.
- `frontend/`: a Next.js 16 app, statically exported (`output: "export"`) and served by the backend.
  - `/login/`: a placeholder sign-in page (PL-8). Any email and password is accepted; the user is kept in localStorage.
  - `/`: the Mutual NDA creator (PL-7). The user fills in a form, sees the NDA update live, and downloads it as a PDF generated in the browser. It reads the two Mutual NDA templates from `../templates` at build time.
  - Pages in `src/app/(app)/` require sign-in (checked in the browser) and share the app shell. Brand colors are Tailwind theme tokens in `src/app/globals.css`. Tests run with Vitest (`npm test`).
- `backend/`: a FastAPI uv project (PL-8) with SQLAlchemy over SQLite. The database is deleted and recreated on every startup and has a `users` table. Endpoints: `GET /api/health` and `POST /api/auth/login` (placeholder sign-in: no password check, creates the user on first sign-in). All other paths serve the frontend build. Tests run with pytest (`uv run pytest`).
- `Dockerfile` (one container on port 8000) and `scripts/` start/stop scripts for Mac, Linux and Windows.

Not built yet: real authentication, AI chat, document persistence and support for the other agreement types.

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

This is the target architecture; see Current state for what is built so far.

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
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