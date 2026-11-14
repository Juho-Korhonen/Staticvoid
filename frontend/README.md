# Wikipedia time travel

React + TypeScript frontend for the Python FastAPI/DuckDB backend and Gemini analysis.

From the repository root, start the backend in one terminal:

    .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000

Then in another terminal:

    cd frontend
    npm ci
    npm run dev     # frontend on :5173 (proxies /api to :8000)

See [server setup](../server/README.md) for dependencies and `GEMINI_API_KEY`.
Submitting the article title and dates with Search requests a short Gemini reading of the actual Wikipedia diff,
with a neutrality verdict, possible framing goal, and exact revision sources.
Analysis covers a bounded set of excerpts; partial readings are labeled.

## Structure
- `src/services/`   talks to the backend (the only place that uses fetch)
- `src/hooks/`      loads data for the UI (loading, error, cancel old requests)
- `src/components/` small display components
- `../server/`      revision lookup, text diffs, and structured Gemini analysis
