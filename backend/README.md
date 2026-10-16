# Prelegal backend

FastAPI app that serves the JSON API under `/api` and the statically exported frontend
(`frontend/out`) for every other path. It is a [uv](https://docs.astral.sh/uv/) project on Python 3.13.

```bash
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

## Layout

| Path                    | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `app/main.py`           | `create_app()`: routers, the JSON 404 for unknown `/api` paths, static files |
| `app/config.py`         | Settings from `PRELEGAL_DB_PATH` and `PRELEGAL_STATIC_DIR`              |
| `app/db.py`             | `init_db()` (recreates the database) and the per-request session dependency |
| `app/models.py`         | SQLAlchemy `Base` and the `User` model                                  |
| `app/schemas.py`        | Request and response models                                             |
| `app/routers/`          | `health` (`GET /api/health`) and `auth` (`POST /api/auth/login`)        |

## Notes

- The SQLite database is deleted and recreated every time the app starts (`init_db` in the lifespan).
  There are no migrations; the schema comes from the models.
- `POST /api/auth/login` is a placeholder: it accepts any password, creates the user on first sign-in,
  and returns `{id, email}`. No password is stored and no token is issued.
- If `frontend/out` doesn't exist (no frontend build yet), the API still runs and `/` returns 404.
