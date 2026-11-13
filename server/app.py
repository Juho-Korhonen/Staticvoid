"""HTTP API for the Node backend.

Run from mariadb/:  uvicorn server.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query

from .changes import ChangesStore, NotFound, parse_when

store: ChangesStore | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global store
    store = ChangesStore()
    yield


app = FastAPI(title="Article changes", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/pages/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=200)):
    return store.search(q, limit)


@app.get("/changes")
def changes(
    start: str,
    end: str,
    title: str | None = None,
    page_id: int | None = None,
    max_revisions: int = Query(200, ge=0, le=5000),
    context_lines: int = Query(2, ge=0, le=20),
):
    if title is None and page_id is None:
        raise HTTPException(400, "title or page_id required")
    try:
        start_dt, end_dt = parse_when(start), parse_when(end)
    except ValueError as e:
        raise HTTPException(400, f"bad date: {e}")
    if start_dt >= end_dt:
        raise HTTPException(400, "start must be before end")
    try:
        pid = store.resolve_page(title=title, page_id=page_id)
        return store.get_changes(pid, start_dt, end_dt, max_revisions, context_lines)
    except NotFound as e:
        raise HTTPException(404, str(e))
