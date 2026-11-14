"""HTTP API for the React frontend.

Run from the repository root: uvicorn server.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .changes import ChangesStore, NotFound, parse_when
from .rhetoric import AnalysisError, iter_analysis, revision_changes, revision_sources

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
    stream: bool = False,
):
    if title is None and page_id is None:
        raise HTTPException(400, "title or page_id required")
    try:
        start_dt, end_dt = parse_when(start), parse_when(end)
    except ValueError as e:
        raise HTTPException(400, f"bad date: {e}")
    if start_dt >= end_dt:
        raise HTTPException(400, "start must be before end")
    if stream and not analyze:
        raise HTTPException(400, "stream requires analyze=true")

    def load_history():
        pid = store.resolve_page(title=title, page_id=page_id)
        # Analysis always loads ALL saved revisions, independently of the response limit.
        return store.get_changes(pid, start_dt, end_dt,
                                 None if analyze else max_revisions, context_lines,
                                 word_details=not analyze)

    if not analyze:
        try:
            return load_history()
        except NotFound as exc:
            raise HTTPException(404, str(exc)) from None

    def events():
        yield {"type": "progress", "stage": "loading"}
        try:
            result = load_history()
            for event in iter_analysis(
                result["title"], revision_changes(result),
                {"revisions": result["summary"]["revisions"], "editors": result["summary"]["editors"]},
            ):
                if event["type"] != "complete":
                    yield event
                    continue
                result["rhetoric_analysis"] = event["analysis"]
                result["rhetoric_analysis"]["sources"] = revision_sources(
                    result["baseline"]["rev_id"] if result["baseline"] else None,
                    result["final"]["rev_id"] if result["final"] else None,
                )
                # Only the raw response list is limited; all edits have already been reviewed.
                result["revisions"] = result["revisions"][-max_revisions:] if max_revisions else []
                result["summary"]["returned"] = len(result["revisions"])
                result["truncated"] = result["summary"]["revisions"] > len(result["revisions"])
                yield {"type": "complete", "result": result}
        except NotFound as exc:
            yield {"type": "error", "status": 404, "detail": str(exc)}
        except AnalysisError as exc:
            yield {"type": "error", "status": exc.status_code, "detail": str(exc)}
        except Exception:
            # A failed stream must not look like an empty or completed review.
            yield {"type": "error", "status": 500, "detail": "Analysis did not complete. Please retry; no complete review is available."}

    if stream:
        return StreamingResponse(
            (json.dumps(event, ensure_ascii=False) + "\n" for event in events()),
            media_type="application/x-ndjson",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    for event in events():
        if event["type"] == "error":
            raise HTTPException(event["status"], event["detail"])
        if event["type"] == "complete":
            return event["result"]
