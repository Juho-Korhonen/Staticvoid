# Article changes API

Python (FastAPI + DuckDB) service that tells what changed in a Finnish Wikipedia
article between two dates, using the M dataset in `data/m/` (every saved version of
~19.7k History of Finland articles, 2003–2026). Meant to be called by the website's
Node backend.

## Install

Requires Python 3.10+. Paste one line in a terminal, in the `mariadb/` folder.

Linux / macOS:

```sh
python3 -m venv .venv && .venv/bin/python -m pip install "duckdb>=1.5,<2" pytz "fastapi>=0.115" "uvicorn>=0.30"
```

Windows (PowerShell):

```powershell
py -m venv .venv; .venv\Scripts\python -m pip install "duckdb>=1.5,<2" pytz "fastapi>=0.115" "uvicorn>=0.30"
```

This creates a local `.venv/` (git-ignored), so nothing is installed system-wide.
(`pytz` is needed for DuckDB to return timezone-aware timestamps.)

## Run

From the `mariadb/` folder (no need to activate the venv):

```sh
.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000
```

Windows: `.venv\Scripts\uvicorn server.app:app --host 127.0.0.1 --port 8000`

Startup takes a few seconds (builds a title index). `DATA_DIR` overrides the Parquet folder.
Interactive docs: http://127.0.0.1:8000/docs

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /pages/search?q=sisällissota&limit=20` | `[{page_id, title, n_versions}]`, matches any title the page has had |
| `GET /changes?title=…` or `?page_id=…`, plus `&start=…&end=…` | All changes in `[start, end)` as a single JSON object |

`/changes` parameters:
- `start`, `end`: ISO date or datetime (`2015-01-01`, `2015-01-01T12:00:00+02:00`). Times without a timezone are UTC. `end` is exclusive.
- `title` (case-insensitive, any historical title) **or** `page_id`.
- `max_revisions` (default 200): keep only the newest N revisions in the range; `truncated: true` when cut.
- `context_lines` (default 2): context in `unified_diff`.

Errors: `400` (bad or missing params, start ≥ end), `404` (unknown article).

## Response

```jsonc
{
  "page_id": 1150,
  "title": "Suomen sisällissota",
  "page": { "n_versions": 3357, "created": "...Z", "last_edit": "...Z", "url": "https://fi.wikipedia.org/w/index.php?curid=1150" },
  "range": { "start": "2015-01-01T00:00:00Z", "end": "2015-03-01T00:00:00Z" },
  "baseline": { "rev_id": 14546671, "timestamp": "...Z", "title": "...", "bytes": 199504 }, // last version before start, null if created in range
  "final":    { "rev_id": 14671122, "timestamp": "...Z", "title": "...", "bytes": 200471 }, // last version before end
  "summary": { "revisions": 21, "returned": 21, "editors": 11, "anonymous_edits": 2,
               "minor_edits": 6, "reverts": 2, "bytes_start": 199504, "bytes_end": 200471 },
  "revisions": [                       // oldest first, each diffed against the previous version
    {
      "rev_id": 14558414, "parent_id": 14546671, "timestamp": "2015-01-04T17:55:53Z",
      "title": "Suomen sisällissota", "user": "THautala", "anonymous": false, "minor": true,
      "comment": "karkoit → karkot", "bytes": 199501, "bytes_delta": -3,
      "is_new_page": false,
      "is_revert": false, "revert_to_rev_id": null, // true when the text equals an earlier version
      "added":   ["...whole paragraph lines added..."],
      "removed": ["...whole paragraph lines removed..."],
      "word_changes": [ { "before": "karkoittavat", "after": "karkottavat",
                          "context": "1500 venäläissotilaan kanssa [[CHANGE]] 650 suojeluskuntalaista, " } ],
      "unified_diff": "@@ -537,5 +537,5 @@\n ..."
    }
  ],
  "net_change": { "added": [], "removed": [], "word_changes": [], "unified_diff": "" }, // baseline → final
  "truncated": false
}
```

`word_changes` is usually the most useful part for reviewing an edit, because a wikitext
paragraph is one long line.

## From Node

```js
const qs = new URLSearchParams({ title: "Suomen sisällissota", start: "2015-01-01", end: "2015-03-01" });
const res = await fetch(`http://127.0.0.1:8000/changes?${qs}`);
if (!res.ok) throw new Error((await res.json()).detail);
const changes = await res.json();
```
