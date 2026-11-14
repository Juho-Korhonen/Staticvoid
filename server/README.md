# Article changes API

Python (FastAPI + DuckDB) service that tells what changed in a Finnish Wikipedia
article between two dates, using the M dataset in `data/m/` (every saved version of
~19.7k History of Finland articles, 2003–2026). The frontend (`frontend/`) calls it
through the Vite proxy: `/api/*` is forwarded to `http://127.0.0.1:8000/*`.

## Install

Requires Python 3.10+. Run from the repository root.

Linux / macOS:

```sh
python3 -m venv .venv && .venv/bin/python -m pip install duckdb pytz fastapi uvicorn google-genai httpx pydantic python-dotenv pyarrow pandas
```

Windows (PowerShell):

```powershell
py -m venv .venv; .venv\Scripts\python -m pip install duckdb pytz fastapi uvicorn google-genai httpx pydantic python-dotenv pyarrow pandas
```

This creates a local `.venv/` (git-ignored), so nothing is installed system-wide.
(`pytz` is needed for DuckDB to return timezone-aware timestamps. `pyarrow` and `pandas`
are not needed by the server, but are handy for exploring the Parquet data.)

## Run

From the repository root (no need to activate the venv):

```sh
.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000
```

Windows: `.venv\Scripts\uvicorn server.app:app --host 127.0.0.1 --port 8000`

Startup takes a few seconds: it builds a title index and loads the current text of every
article for search. Expect the server to use about 1–1.5 GB of RAM. `DATA_DIR` overrides the Parquet folder.
Interactive docs: http://127.0.0.1:8000/docs

`CORS_ORIGINS` is **deprecated** and off by default: the frontend reaches this service
through the Vite proxy (see below), so no cross-origin calls happen. Set it to a
comma-separated list of origins only if a page on another origin must call the API directly.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /pages/search?q=sisällissota&limit=20` | `[{page_id, title, n_versions}]`, matches any title the page has had |
| `GET /pages/search_text?q=mannerheim talvisota&limit=20&offset=0` | Full-text search of the articles' current text (see below) |
| `GET /changes?title=…` or `?page_id=…`, plus `&start=…&end=…` | All changes in `[start, end)` as a single JSON object |

`/pages/search_text` parameters:
- `q`: words that must **all** appear, case-insensitive. Terms match as substrings, which helps
  with Finnish inflection: `talviso` finds both `talvisota` and `talvisodan`.
  `"double quotes"` keep a phrase together. Up to 10 terms.
- `limit` (default 20, max 100) and `offset` (default 0) for paging.

Searches the latest version of each article (redirect pages are skipped), so text that was
removed earlier is not found; use `/changes` for history. Ranked by how many terms are in the
title, then by how often the terms occur. About 0.2–0.6 s per query.

```jsonc
{
  "query": "mannerheim talvisota",
  "terms": ["mannerheim", "talvisota"],
  "total": 272,                       // all matches; "results" is one page of them
  "results": [
    {
      "page_id": 1256, "title": "Talvisota", "n_versions": 2143, "last_edit": "...Z",
      "rev_id": 24273471,            // the version that was searched (the latest)
      "hits": 109,                    // occurrences of all terms in the text
      "snippet": {
        "text": "Talvisota käytiin Suomen ja Neuvostoliiton välillä 30. marraskuuta 1939 – …",
        "matches": [[0, 9]]           // [start, end) character offsets of hits in "text", for highlighting
      },
      "url": "https://fi.wikipedia.org/w/index.php?curid=1256"
    }
  ]
}
```

The snippet is the readable text around the first hit, with links, templates and references
stripped. If a term only occurs inside markup (for example an infobox), the snippet shows raw
wikitext instead.

`/changes` parameters:
- `start`, `end`: ISO date or datetime (`2015-01-01`, `2015-01-01T12:00:00+02:00`). Times without a timezone are UTC. `end` is exclusive.
- `title` (case-insensitive, any historical title) **or** `page_id`.
- `max_revisions` (default 200): keep only the newest N revisions in the range; `truncated: true` when cut.
- `context_lines` (default 2): context in `unified_diff`.

Errors: `422` (missing or out-of-range params), `400` (bad date, start ≥ end, neither
`title` nor `page_id`), `404` (unknown article).

## Gemini rhetoric analysis

Set `GEMINI_API_KEY` in the server environment or the root `.env` (see
`.env.example`). Exported variables take precedence. The key stays on the Python
server; never put it in frontend code or a `VITE_` variable. `.env` files are ignored
by Git. Restart the server after changing configuration.

Add `analyze=true` to the existing endpoint:

```sh
curl 'http://127.0.0.1:8000/changes?title=Talvisota&start=2015-01-01&end=2016-01-01&max_revisions=0&analyze=true'
```

The pipeline stays Parquet → DuckDB → revision selection → text diff, followed
by one request through Google's official `google-genai` SDK. The response adds
`rhetoric_analysis` with `summary`, `model`, `partial`, `totalChanges`, and `changes`.
The reading includes `overallNeutrality`, a short `summary`, and `possibleAgenda`
(a tentative interpretation of framing, or null when unsupported). Comparisons
can span many editors; the reading does not establish an individual's intent.
Each change contains the source excerpts, `explanation`, `framingChanges`,
`neutralWording`, `neutrality`, `toneDelta` (-2 to +2), and `hedgeAdded`.
`evidenceBefore` and `evidenceAfter` are exact source passages selected by Gemini
using schema-constrained IDs and supplied by the server. `sources` links to the exact earlier/later Wikipedia
revisions and their diff; these URLs are built from dataset IDs, never generated
by Gemini. These sources support wording comparisons, not historical fact checks.
Positive tone does not imply neutrality. Explanations are English; suggested
wording preserves the source language. JSON output is validated with Pydantic.

For hackathon latency and cost, analysis covers the first 12 diff blocks, at most
2,000 characters per before/after excerpt. `partial` and `textTruncated` indicate
these limits. The raw diff remains available; `blocks` contains paired before/after
text. Missing endpoint revisions return 400; identical revisions need no API call.
Omitting `analyze=true` makes no Gemini request. The default model is
`gemini-3.5-flash-lite`; override it with `GEMINI_MODEL` if needed.
Quota failures return 429, configuration/connectivity failures 503, invalid model
responses 502, and timeouts 504, without exposing SDK error bodies or credentials.

Run the opt-in live smoke test (one real API request, uses your project's quota):

```sh
.venv/bin/python -m server.smoke_gemini
```

It prints `PASS` and validated analysis of a short synthetic wording change, or
exits nonzero with a safe error. No key is printed. SDK reference:
[Google GenAI Python SDK](https://googleapis.github.io/python-genai/).

The React frontend calls `/changes?analyze=true` for the submitted Finnish Wikipedia
article (default: `Suomen sisällissota`). It shows a short reading and possible framing goal. Expand “Why?”
for the leading findings with quoted evidence and details of the remaining changes.

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

## From the frontend

Run this service and `npm run dev` in `frontend/`, then call the
API under `/api` on the frontend's own origin. Vite strips the `/api` prefix and forwards the
request to port 8000, so there is no CORS to deal with.

```js
const qs = new URLSearchParams({ title: "Suomen sisällissota", start: "2015-01-01", end: "2015-03-01" });
const res = await fetch(`/api/changes?${qs}`);
if (!res.ok) throw new Error((await res.json()).detail);
const changes = await res.json();
```
