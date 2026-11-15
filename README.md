# Wiki the truth

A bias and vandalism monitor for Wikipedia.

Wikipedia’s neutrality takes constant work. A single changed word can shift an article’s meaning. Pick an article and two dates to see what changed and whether the wording pushes an agenda.

- **Overview:** See suspicious edits by type and over time.
- **Evidence:** Compare wording and read Gemini’s explanation of possible bias or vandalism.
- **Accountability:** Find accounts with multiple suspicious revisions and expand their edits. IP editors appear as `[Anonymous]`.

Every flag is a lead for human review, not a verdict.

The current prototype reviews saved Finnish Wikipedia revisions from MariaDB’s Wikipedia dataset, stored in a MariaDB system-versioned table: every revision is a history row, so the database itself answers what an article said on any date. Built with React, TypeScript, FastAPI, MariaDB, and Gemini.

## Run locally

Requires Python 3.10+, Node.js, a MariaDB server (see [backend](server/README.md#database)), and the [dataset](data/m/README.md) in `data/m/`. Set `GEMINI_API_KEY` in a root `.env` file using [.env.example](.env.example).

Start the backend (the load runs once):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m server.load_mariadb
.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173), click **Start review**, then explore **history**, **full review**, or **suspicious editors**.

More details: [backend](server/README.md) · [frontend](frontend/README.md).
