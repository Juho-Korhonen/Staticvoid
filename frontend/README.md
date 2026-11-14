# Wikipedia time travel

React + TypeScript frontend for the Python FastAPI/DuckDB backend and Gemini analysis.

From the repository root, start the backend in one terminal:

    .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000

Then in another terminal:

    cd frontend
    npm ci
    npm run dev     # frontend on :5173 (proxies /api to :8000)

See [server setup](../server/README.md) for dependencies and `GEMINI_API_KEY`.
Submitting the article title and dates with Search reviews every saved edit in the
period, including reverted edits. Progress shows revisions and passages inspected.
Long changes are split into batches rather than truncated. Results include flags,
a neutrality verdict, possible framing goals and exact per-edit revision sources.
The end date is exclusive (UTC). Longer periods use more time and Gemini quota;
Cancel review stops the stream, and incomplete reviews are never labeled complete.

## Structure
- `src/services/`   talks to the backend (the only place that uses fetch)
- `src/hooks/`      loads data for the UI (debounce, loading, error, cancel old requests)
- `src/components/` small display components
- `src/utils/`      text cleanup and review ordering helpers
- `src/types.ts`    API and UI types; `src/labels.ts` display labels
- `../server/`      revision lookup, text diffs, and structured Gemini analysis
