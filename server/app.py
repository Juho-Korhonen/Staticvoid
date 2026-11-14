"""HTTP API for the React frontend.

Run from the repository root: uvicorn server.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from http import HTTPStatus

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .dates import parse_when
from .diff import DEFAULT_CONTEXT_LINES
from .rhetoric import AnalysisError, iter_analysis, revision_changes
from .store import DEFAULT_LIMIT, DEFAULT_MAX_REVISIONS, ChangesStore, NotFound
from .wiki import revision_sources

logger = logging.getLogger(__name__)

SEARCH_LIMIT_MAX = 200
TEXT_LIMIT_MAX = 100
QUERY_MAX_LENGTH = 500
MAX_REVISIONS_MAX = 5000
CONTEXT_LINES_MAX = 20
INCOMPLETE_ANALYSIS = "Analysis did not complete. Please retry; no complete review is available."


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = ChangesStore()
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


def get_store(request: Request) -> ChangesStore:
    return request.app.state.store


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/pages/search")
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=SEARCH_LIMIT_MAX),
    store: ChangesStore = Depends(get_store),
):
    return store.search(q, limit)


@app.get("/pages/search_text")
def search_text(
    q: str = Query(..., min_length=1, max_length=QUERY_MAX_LENGTH),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=TEXT_LIMIT_MAX),
    offset: int = Query(0, ge=0),
    store: ChangesStore = Depends(get_store),
):
    return store.search_text(q, limit, offset)


def _parse_range(start: str, end: str) -> tuple[datetime, datetime]:
    try:
        start_dt, end_dt = parse_when(start), parse_when(end)
    except ValueError as e:
        raise HTTPException(HTTPStatus.BAD_REQUEST, f"bad date: {e}") from None
    if start_dt >= end_dt:
        raise HTTPException(HTTPStatus.BAD_REQUEST, "start must be before end")
    return start_dt, end_dt


def _limit_revisions(result: dict, max_revisions: int) -> None:
    """Only the raw response list is limited; all edits have already been reviewed."""
    result["revisions"] = result["revisions"][-max_revisions:] if max_revisions else []
    result["summary"]["returned"] = len(result["revisions"])
    result["truncated"] = result["summary"]["revisions"] > len(result["revisions"])


def _analyzed(result: dict, analysis: dict, max_revisions: int) -> dict:
    baseline, final = result["baseline"], result["final"]
    analysis["sources"] = revision_sources(baseline["rev_id"] if baseline else None,
                                           final["rev_id"] if final else None)
    result["rhetoric_analysis"] = analysis
    _limit_revisions(result, max_revisions)
    return result


def _analysis_events(load_history, max_revisions: int):
    """Progress events, then exactly one `complete` or `error` event."""
    yield {"type": "progress", "stage": "loading"}
    try:
        result = load_history()
        context = {"revisions": result["summary"]["revisions"], "editors": result["summary"]["editors"]}
        for event in iter_analysis(result["title"], revision_changes(result), context):
            if event["type"] == "complete":
                yield {"type": "complete", "result": _analyzed(result, event["analysis"], max_revisions)}
            else:
                yield event
    except NotFound as exc:
        yield {"type": "error", "status": HTTPStatus.NOT_FOUND, "detail": str(exc)}
    except AnalysisError as exc:
        yield {"type": "error", "status": exc.status_code, "detail": str(exc)}
    except Exception:
        # A failed stream must not look like an empty or completed review.
        logger.exception("analysis failed")
        yield {"type": "error", "status": HTTPStatus.INTERNAL_SERVER_ERROR, "detail": INCOMPLETE_ANALYSIS}


def _ndjson(events) -> StreamingResponse:
    return StreamingResponse(
        (json.dumps(event, ensure_ascii=False) + "\n" for event in events),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _single_result(events) -> dict:
    for event in events:
        if event["type"] == "error":
            raise HTTPException(event["status"], event["detail"])
        if event["type"] == "complete":
            return event["result"]
    raise HTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, INCOMPLETE_ANALYSIS)


@app.get("/changes")
def changes(
    start: str,
    end: str,
    title: str | None = None,
    page_id: int | None = None,
    max_revisions: int = Query(DEFAULT_MAX_REVISIONS, ge=0, le=MAX_REVISIONS_MAX),
    context_lines: int = Query(DEFAULT_CONTEXT_LINES, ge=0, le=CONTEXT_LINES_MAX),
    analyze: bool = False,
    stream: bool = False,
    store: ChangesStore = Depends(get_store),
):
    if page_id is None and not (title and title.strip()):
        raise HTTPException(HTTPStatus.BAD_REQUEST, "title or page_id required")
    start_dt, end_dt = _parse_range(start, end)
    if stream and not analyze:
        raise HTTPException(HTTPStatus.BAD_REQUEST, "stream requires analyze=true")

    def load_history() -> dict:
        pid = store.resolve_page(title=title, page_id=page_id)
        # Analysis always loads ALL saved revisions, independently of the response limit.
        return store.get_changes(pid, start_dt, end_dt,
                                 None if analyze else max_revisions, context_lines,
                                 word_details=not analyze)

    if not analyze:
        try:
            return load_history()
        except NotFound as exc:
            raise HTTPException(HTTPStatus.NOT_FOUND, str(exc)) from None

    events = _analysis_events(load_history, max_revisions)
    return _ndjson(events) if stream else _single_result(events)
