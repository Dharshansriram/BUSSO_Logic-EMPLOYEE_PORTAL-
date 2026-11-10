# IntelliFlow — Operations OS

IntelliFlow is a small "operations dashboard" web app: a manager/employee
workspace for tracking projects, tasks, team capacity, schedules, and
AI-flavored delay predictions. It's a single-page React app talking to an
Express/MongoDB backend.

This README covers how to run it locally end‑to‑end, and how the pieces
fit together.

## What was fixed

The project as delivered would not run cleanly outside the platform it was
generated on. The main issues found and fixed:

1. **Cursor showing on plain text** — no default `cursor` was set anywhere,
   so the browser fell back to the text-selection (I-beam) cursor over
   every heading, label, and paragraph. Fixed in `client/src/intelliflow.css`:
   `cursor: default` is now set globally, `cursor: pointer` is applied
   explicitly to every clickable element (buttons, nav items, table rows,
   calendar cells, etc.), and `cursor: text` is reserved for actual inputs.
2. **`pnpm install` would fail outside the original platform** —
   `vite.config.ts` and `package.json` referenced `vite-plugin-manus-runtime`
   and `@builder.io/vite-plugin-jsx-loc`, two dev tools private to the
   platform this app was generated on (not published to the public npm
   registry). They were removed; nothing in the app depends on them.
3. **Dev server hot-reload never actually cache-busted** — `server/_core/vite.ts`
   was looking for `src="/src/main.tsx"` in `index.html` to append a
   cache-busting query string, but this project's real entry file is
   `main.jsx`. The string never matched. Fixed to match `main.jsx`.
4. **A 404 network request on every page load** — `client/index.html` had
   an analytics `<script>` tag pointed at `%VITE_ANALYTICS_ENDPOINT%`,
   which is blank unless you configure analytics. That produced a failed
   request to `/umami` on every load. It's now commented out (see the file
   for how to re-enable it if you want analytics).
5. **A missing import** — `server/storage.ts` used `crypto.randomUUID()`
   without importing `crypto`. Added the import so the file storage helpers
   don't crash if used.

None of these were "one-line typo" bugs you'd spot by skimming — they only
show up when you actually try to install and run the project, which is
exactly the "make it end-to-end runnable" ask.

## How the project is put together

```
client/               React frontend (Vite)
  src/App.jsx          entry component — just renders <Home />
  src/main.jsx         React root mount
  src/pages/Home.jsx        the main dashboard (login, projects, tasks, AI panel)
  src/pages/OperationsView.jsx   "My tasks / Team capacity / Analytics" screens
  src/intelliflow.css   all styling (plain CSS, no framework)
  index.html            HTML shell Vite serves

server/
  _core/index.ts        app entry point — starts Express, wires everything up
  _core/vite.ts          dev-mode: runs Vite middleware; prod-mode: serves client/dist
  api.js                 the REST API the frontend actually calls (/api/...)
  routers.ts              a small tRPC router (mostly unused scaffolding)
  db.ts                   all data access: MongoDB via Mongoose, with an
                           in-memory fallback so the app still works with no DB
  models.ts                Mongoose schemas (Project, Task, Employee, ...)
  intelligence.js          the "AI" layer: a deterministic logistic-regression-
                           style risk scorer, plus an optional real LLM call
  _core/oauth.ts, storageProxy.ts, sdk.ts, ...
                           platform integrations (SSO login, S3 file storage)
                           that only activate if you configure their env vars —
                           safe to ignore for local use

shared/                 types and constants shared by client & server
drizzle/                leftover SQL migration files from an earlier version
                         of the app before it moved to MongoDB — not used by
                         the running app, kept only for history
```

### Request flow (the important part)

1. The browser loads `client/index.html`, which boots `main.jsx` → `App.jsx`
   → `Home.jsx`.
2. `Home.jsx` calls plain REST endpoints under `/api/...` (see `server/api.js`)
   — login, fetch dashboard data, update a task, resolve an alert, generate
   a workflow.
3. `server/api.js` calls into `server/db.ts`, which either talks to MongoDB
   (if `MONGODB_URI` is set and reachable) or falls back to an in-memory
   demo dataset seeded on first request. This is why the app "just works"
   with zero setup, but why changes don't persist without a real database.
4. The "AI Operations Copilot" panel and the Analytics screen pull from
   `server/intelligence.js`, which scores tasks with a small deterministic
   formula (blocked status, priority, time-to-deadline, effort overrun,
   assignee overload) — no external API calls unless you explicitly opt in
   with `ENABLE_LLM=true`.

### Auth

Login is email/password against the `Employee` collection (or the demo
employees in `db.ts` when there's no database), with a signed session
cookie. There's also a separate, unused tRPC-based OAuth flow
(`server/_core/oauth.ts`) left over from the platform template — it's not
wired into the login screen and requires platform-specific env vars, so you
can ignore it.

## Running it locally

**Prerequisites:** Node.js 20+ and `pnpm` (`npm install -g pnpm`).

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env .env
# Edit .env — at minimum set JWT_SECRET to any random string.
# MONGODB_URI is optional: leave it blank to use the built-in demo data,
# or point it at a local/Atlas MongoDB instance to persist changes.

# 3. Start the dev server (hot reload)
pnpm dev
# → Server running on http://localhost:3000/
```

Open `http://localhost:3000` and sign in with the seeded demo account:

- **Email:** `maya@acme.test`
- **Password:** `Welcome123!`

### Production build

```bash
pnpm build   # builds the client (Vite) and bundles the server (esbuild)
pnpm start   # runs the built app from dist/
```

### Other scripts

```bash
pnpm check   # TypeScript type-check, no emit
pnpm test    # runs the Vitest test suite
pnpm format  # Prettier --write
```

### Optional: a real MongoDB

```bash
# local Mongo via Docker, if you don't have one installed
docker run -d -p 27017:27017 --name intelliflow-mongo mongo:7
```
Then set `MONGODB_URI=mongodb://127.0.0.1:27017/intelliflow` in `.env`.
See `MONGODB_SETUP.md` for Atlas connection strings and more detail.
Mongoose creates collections and seeds the demo workspace automatically the
first time the app connects to an empty database — no manual migration step.

## Notes on scope

- `drizzle/` and the `db:push`-style migration tooling referenced in
  `template.json` are leftovers from an earlier MySQL/Drizzle version of
  this template; the running app uses MongoDB/Mongoose exclusively
  (`MONGODB_SETUP.md`), so you can ignore Drizzle entirely.
- File storage (`server/storage.ts`, `server/_core/storageProxy.ts`) and
  platform SSO (`server/_core/oauth.ts`) require Manus-platform credentials
  and aren't used by anything in the current UI — they're safe to leave
  unconfigured.
