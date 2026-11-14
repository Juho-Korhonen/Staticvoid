"""HTTP API for the React frontend.

Run from the repository root: uvicorn server.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .changes import ChangesStore, NotFound, parse_when
from .rhetoric import AnalysisError, analyze_changes

store: ChangesStore | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global store
    store = ChangesStore()
    yield


app = FastAPI(title="Article changes", lifespan=lifespan)

# DEPRECATED: CORS. The Vite dev/preview server proxies /api to this service, so the
# browser never makes a cross-origin call. Off by default; set CORS_ORIGINS to a
# comma-separated list (e.g. "https://example.org") only if a page on another origin
# must call this service directly. Will be removed.
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/pages/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=200)):
    return store.search(q, limit)


@app.get("/pages/search_text")
def search_text(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return store.search_text(q, limit, offset)


@app.get("/changes")
def changes(
    start: str,
    end: str,
    title: str | None = None,
    page_id: int | None = None,
    max_revisions: int = Query(200, ge=0, le=5000),
    context_lines: int = Query(2, ge=0, le=20),
    analyze: bool = False,
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
        result = store.get_changes(pid, start_dt, end_dt, max_revisions, context_lines)
    except NotFound as e:
        raise HTTPException(404, str(e))
    if analyze:
        if not result["baseline"] or not result["final"]:
            raise HTTPException(400, "Rhetoric analysis requires saved revisions at both endpoints.")
        try:
            result["rhetoric_analysis"] = analyze_changes(
                result["title"], result["net_change"]["blocks"],
                {"revisions": result["summary"]["revisions"], "editors": result["summary"]["editors"]},
            )
        except AnalysisError as exc:
            raise HTTPException(exc.status_code, str(exc)) from None
        before_id, after_id = result["baseline"]["rev_id"], result["final"]["rev_id"]
        wiki = "https://fi.wikipedia.org/w/index.php"
        # Cite actual dataset revision IDs; the model never invents source URLs.
        result["rhetoric_analysis"]["sources"] = {
            "before": f"{wiki}?oldid={before_id}",
            "after": f"{wiki}?oldid={after_id}",
            "diff": f"{wiki}?oldid={before_id}&diff={after_id}",
        }
    return result
