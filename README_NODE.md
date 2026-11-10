# BUSSOLOGIC — JavaScript (Node.js + Express) stack

Everything outside `backend/` is now plain JavaScript (ESM). The Python FastAPI
backend (`backend/`, `run.py`, `requirements.txt`) is unchanged and still works.
Both backends expose the same `/api` contract on port 8000, so run **one** of them.

```
client/        React (JSX) + Vite            (unchanged)
shared/        const.js, _core/errors.js     (was .ts)
server/
  index.js     entry point (listen, startup, shutdown)
  app.js       Express app: CORS, JSON, routes, static client, error handler
  routes/      auth, operations (dashboard/tasks/projects/alerts/audit/SSE), people, intelligence
  core/        database (MongoDB + in-memory fallback), auth, passwords, events, schemas (zod), http helpers
  intelligence/ predictions, workload, decisionSimulator, copilotEngine, recommendations
  ml/          pipeline.js (trains the delay model, writes models/model_metrics.json)
  _core/       env.js + optional Manus "Forge" helpers (llm, storage, map, image, voice, notification)
  tests/       vitest suites
```

## Run

```bash
npm install
cp .env .env        # MONGODB_URI is optional; without MongoDB it runs on seeded in-memory demo data
npm run dev                 # Express API (:8000) + Vite client (:5173)
npm test                    # vitest
npm run build && npm start  # production: Express serves dist/public
```

Python stack is still available: `npm run dev:backend` / `npm run start:python` / `npm run test:backend`.

Demo logins (password `Welcome123!`): maya@acme.test (manager), ari@acme.test (admin), noah@acme.test (employee).

## What was removed
tRPC (`routers.ts`, `_core/trpc|context|systemRouter`), the Manus OAuth chain (`oauth`, `sdk`, `cookies`),
Mongoose models / old `db.ts` (replaced by `core/database.js`, same collection names as the Python backend),
`heartbeat.ts`, Drizzle schema stubs, `tsconfig.json` (replaced by `jsconfig.json`). The client never used them.
