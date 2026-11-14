# Wikipedia time travel

React + TypeScript frontend, small Express backend with sample data.

    npm install
    npm run server   # backend on :3001
    npm run dev      # frontend on :5173 (proxies /api to the backend)

## Structure
- `src/services/`   talks to the backend (the only place that uses fetch)
- `src/hooks/`      loads data for the UI (loading, error, cancel old requests)
- `src/components/` small display components
- `server/index.ts` diff + tone scoring; swap `getRevisionAt` for a MariaDB
                    `FOR SYSTEM_TIME AS OF` query
