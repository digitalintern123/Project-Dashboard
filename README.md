# Encalm Project Dashboard

Internal project-control dashboard for Encalm Hospitality: portfolio health, stage progress, milestones, issues, commercial position, site photographs and an update feed, with email notifications.

**React 19 · Vite 7 · Tailwind CSS v4 · Node.js 22 · Express 5 · TypeScript · SQLite (better-sqlite3)**

- **Roles:** `coordinator` (full edit), `lead` (edits own and unassigned projects), `hod` (read-only, approvals).
- **Security:** httpOnly cookie sessions with refresh-token rotation, CSRF header check, bcrypt passwords with forced change on first sign-in, account lockout, rate limits, zod validation on every route, audit log, encrypted email secrets, strict CSP.
- **Ops:** versioned migrations, nightly backups with tested restore, structured JSON logs, optional Sentry, CI, and release-based deploys with automatic rollback.

Running it in production: **[PRODUCTION.md](PRODUCTION.md)**.

---

## Development

Requires Node.js **22** (20.19+ works) and npm 10.

```bash
npm install
cp .env.example .env        # optional: everything has a development default
npm run dev                 # API on :5000 and Vite on :5173 (proxying /api)
```

Open <http://localhost:5173>. On first start against an empty database the server creates the standard accounts and prints their **temporary passwords once** in the terminal; each must be changed at first sign-in. To add or reset an account:

```bash
npm run create-user:dev -- "Full Name" you@encalm.com "Temp-pass-123" coordinator
```

Data lives in `server/data/` (git-ignored): `encalm.db` and `uploads/`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API (`tsx watch`) and Vite together |
| `npm run build` | Web app to `dist/`, server to `server/dist/` |
| `npm start` | Run the built server (serves API and web app) |
| `npm run migrate` / `migrate:dev` | Apply pending database migrations |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run typecheck` | `tsc` over web, server and tests |
| `npm run format` / `format:check` | Prettier |
| `npm test` | All Vitest projects (server, unit, web) |
| `npm run test:api` / `test:unit` | Server API tests / web and unit tests |
| `npm run coverage` | Server and unit tests with coverage (≥ 80 % lines) |
| `npm run test:e2e` | Playwright end-to-end tests (builds the app first) |
| `npm run lighthouse` | Lighthouse audit of the signed-in app (≥ 90 required) |
| `npm run test:backup` | Backup/restore round trip in a temporary folder |

A pre-commit hook (Husky + lint-staged) formats and lints staged files. CI runs all of the above plus `npm audit` and a gitleaks secret scan on every push.

## Project structure

```
src/                         React app
  App.tsx                    Routes (wouter), lazy-loaded pages
  pages/                     Route entry points (thin re-exports)
  features/                  Page implementations: dashboard, workspace (all list
                             views and the new-project form), project-detail, area-sheet
  components/                Shared components; components/ui = shadcn/ui primitives
  state/app-state.tsx        Session, projects and mutations (talks to the API)
  lib/                       API client, calculations, dates, monitoring (Sentry)
  data/                      Domain types and reference data
server/src/                  Express API
  app.ts                     Middleware, security headers, routing, error handling
  routes/                    Thin HTTP handlers (validation, auth, audit)
  services/                  Business logic (projects, items, auth, photos, email)
  repositories/              All SQL
  db/migrations/             Versioned schema migrations (NNN_name.sql)
  validation/                zod schemas
  utils/                     Sessions, passwords, audit, backups, transactions
server/test/                 API and unit tests (Vitest + Supertest)
e2e/                         Playwright tests and Lighthouse audit
deploy/                      VPS setup, deploy/rollback scripts, nginx, PM2, logrotate
scripts/                     Backup, restore, server build
```

Further reading: [`notes.md`](notes.md) (architecture notes), [`docs/roadmap.md`](docs/roadmap.md).

