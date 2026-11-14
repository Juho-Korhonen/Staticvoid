# Wikipedia time travel

React + TypeScript frontend for the Python article-changes API in `../server`
(FastAPI + DuckDB over the Finnish Wikipedia dataset).

    # 1. API, from mariadb/ (see ../server/README.md for installing it)
    .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000

    # 2. Frontend, from mariadb/frontend/
    npm install
    npm run dev      # http://localhost:5173

The browser calls the API at `http://127.0.0.1:8000`, which allows CORS from
the Vite ports. To use another address, put `VITE_API_URL=...` in `frontend/.env`
and add the frontend's origin to `CORS_ORIGINS` on the server.

## Structure
- `src/services/`   talks to the API (the only place that uses fetch)
- `src/hooks/`      loads data for the UI (loading, error, cancel old requests)
- `src/components/` small display components
- `src/types.ts`    response shapes, mirrors `../server/README.md`
