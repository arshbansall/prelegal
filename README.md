# prelegal
A platform for drafting common legal agreements

## Status

🚧 **In progress.** This project is under active development and is expected to be completed within one week (target: October 20, 2026).

## Running Prelegal

Requires [Docker](https://www.docker.com/). Put `OPENROUTER_API_KEY=...` in a `.env` file in the project root (optional for now).

| Platform | Start                              | Stop                              |
| -------- | ---------------------------------- | --------------------------------- |
| macOS    | `scripts/start-mac.sh`             | `scripts/stop-mac.sh`             |
| Linux    | `scripts/start-linux.sh`           | `scripts/stop-linux.sh`           |
| Windows  | `scripts\start-windows.ps1`        | `scripts\stop-windows.ps1`        |

The start script builds the image, starts a container named `prelegal` and waits until the app is
healthy at <http://localhost:8000>. Sign in with any email and password (sign-in is a placeholder).
The SQLite database lives inside the container, so stopping discards it and every start begins fresh.

## Project layout

- `templates/`: Common Paper legal agreement templates (CC BY 4.0), indexed by `catalog.json`.
- `frontend/`: Next.js app, statically exported and served by the backend. See [`frontend/README.md`](frontend/README.md).
- `backend/`: FastAPI app (uv project). Serves `/api/*` and the frontend. See [`backend/README.md`](backend/README.md).
- `scripts/`: start/stop scripts for Docker.
- `Dockerfile`: builds the frontend with Node, then runs the backend with Python 3.13 as a non-root user.

## Development

Run the backend and frontend separately for live reload:

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000   # API on :8000
cd frontend && npm run dev                                        # app on :3000, proxies /api to :8000
```

Tests: `cd backend && uv run pytest` and `cd frontend && npm test`.
