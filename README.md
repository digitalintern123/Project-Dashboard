# Encalm Project Dashboard

Internal project-control dashboard for Encalm Hospitality: portfolio health, stage
progress, milestones, issues, commercial position, and an update feed.

**Full-Stack React 19 · Node.js & Express · TypeScript · SQLite (better-sqlite3) · Vite 7 · Tailwind CSS v4**

The dashboard features a **fully functional Node.js + Express backend** powered by an embedded **SQLite database (`server/data/encalm.db`)** in WAL mode. Projects, stages, milestones, issues, updates, and notifications are stored relationsally in SQLite and served through REST endpoints protected by JWT and role-based access control (RBAC).

> **Core User Accounts & Role Permissions**:
> - **Project HOD (`hod@encalm.com` / `encalm`)**: Portfolio-wide read-only view with milestone approval & rejection authority.
> - **Project Lead (`lead@encalm.com` / `encalm`)**: Full project creation, stage workflow updates, milestone management, and risk register logging.

---

## 1. Prerequisites

| Requirement | Version | Check |
| --- | --- | --- |
| Node.js | **20.19+ or 22.12+** (Vite 7 & Express TS) | `node -v` |
| npm | 10+ (ships with Node) | `npm -v` |

---

## 2. Setup and Run

```bash
# 1. install dependencies
npm install

# 2. start full-stack application (Backend on :5000 + Frontend on :5173 concurrently)
npm run dev
```

Open <http://localhost:5173>. The frontend Vite dev server automatically proxies `/api` calls directly to the Express backend at `http://localhost:5000`.

### Signing In

| Email | Password | Role | Access Permissions |
| --- | --- | --- | --- |
| `hod@encalm.com` | `encalm` | Project HOD (Ruchika Chauhan) | Read portfolio, approve/reject control points |
| `lead@encalm.com` | `encalm` | Project Lead (Chinmay Saxena) | Full project create/edit, stages, issues, milestones |

---

## 3. Full-Stack NPM Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs backend Express server (`:5000`) and Vite frontend (`:5173`) concurrently |
| `npm run server` | Starts only the Express TypeScript backend server |
| `npm run seed` | Re-seeds SQLite database with the standard 20 projects |
| `npm run build` | Builds frontend production bundle to `dist/` |
| `npm run typecheck` | Full TypeScript type check across both frontend and backend |

Run `npm run typecheck` before committing — `npm run build` does not fail on type
errors.

---

## 4. Debugging in VS Code

`.vscode/launch.json` ships with two configurations.

1. Start the dev server: `npm run dev`
2. Open the **Run and Debug** panel (`Ctrl+Shift+D` / `Cmd+Shift+D`)
3. Pick **Debug in Chrome** (or **Debug in Edge**) and press `F5`

Breakpoints in `.tsx` files resolve through Vite's source maps. `.vscode/tasks.json`
also exposes `dev` and `typecheck` via `Ctrl+Shift+B`.

---

## 5. Project structure

```
src/
  main.tsx               Entry point, mounts the root error boundary
  App.tsx                Routes (wouter) and providers
  index.css              Tailwind v4 theme, colour tokens, motion rules
  data/
    projects.ts           Seed data (20 demo projects), domain types, formatters
    users.ts              Stable user identity — every project's `leadId` points here
  state/app-state.tsx    Role, project state, persistence, RBAC — see notes.md §4
  lib/
    storage.ts           localStorage access that never throws
    date.ts              Date parsing/formatting that never throws
    calculations.ts      Planned progress, variance, commercial ratios —
                          the one place these are computed, see notes.md §7
    utils.ts             `cn()` class merger
  pages/
    dashboard.tsx         "/" — portfolio KPIs, health donut, attention list
    workspace.tsx         nine views (projects, timeline, milestones, issues,
                           commercial, updates, reports, new-project) in one
                           file, selected by a `view` prop from the router
    project-detail.tsx    "/project/:id" — tabbed single-project view
    login.tsx             role picker (not real authentication)
    not-found.tsx         catch-all route
  components/
    app-shell.tsx        Sidebar, header, settings dialog
    error-boundary.tsx   Route-level error recovery
    ui/                  shadcn/ui primitives (generated — see components.json)
  hooks/                 use-toast · use-mobile
```

### Things you'll likely change

- **Projects and seed data** → `src/data/projects.ts`
- **Project leads** → `src/data/users.ts`. Add a person there before
  assigning `leadId` to a project — don't reintroduce a bare name string.
- **Colours, fonts, theme tokens** → `src/index.css` (`:root` block)
- **Navigation items** → `src/components/app-shell.tsx`
- **Routes** → `src/App.tsx`
- **Who can edit** → `EDITOR_ROLES` in `src/state/app-state.tsx` (currently
  only `lead`; HOD is read-only by not being in that list)
- **Adding a new mutation** → wrap it through `mutate`/`patchById` in
  `app-state.tsx`, not a direct `setProjectState` call — see `notes.md` §4
  and §11 for why
- **Adding a new calculated number** → put it in `src/lib/calculations.ts`
  so every page reads the same value — see `notes.md` §7

If the app ever shows stale data, open DevTools → Application → Local Storage and
clear the `encalm-*` keys, or use **Settings → Reset demo data** in the app.

---

## 6. Publishing to GitHub

```bash
# from the project root
git init
git branch -M main

git add .
git status                 # confirm no .env.local, no node_modules, no dist
git commit -m "Initial commit: Encalm project dashboard"

# create an empty repo on github.com first (no README, no .gitignore),
# then point this one at it
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Subsequent pushes:

```bash
git add .
git commit -m "Describe the change"
git push
```

`.gitignore` already excludes `node_modules/`, `dist/`, every `.env*` file except
`.env.example`, caches, logs, key and certificate files, and OS cruft. Verify with
`git status` before your first commit — once a secret is pushed, rewriting history
does not un-leak it; rotate the credential instead.

---

## 7. Deploying

The app is a single Node.js server that serves both the API and the built frontend; it cannot be hosted as a static site. See [PRODUCTION.md](PRODUCTION.md) for deploying to the VPS.

---

## 8. Known limitations

This is a frontend-only prototype, now past **Stage 1** of the product
roadmap (see [`docs/roadmap.md`](./docs/roadmap.md)) — every number on
screen is either calculated from real project data or explicitly labelled
"unavailable"; nothing is fabricated. The remaining gaps are structural,
tracked as Stage 2 onward:

- **Sign-in is a role picker, not authentication** — any non-empty password
  is accepted. Do not expose this to the public internet with real project
  data.
- **All data lives in one browser.** Nothing is shared between users or
  devices, there is no server, and clearing site data loses local edits.
  There is also no audit trail — editing a value overwrites it with no
  history of the previous one.
- **`project.health` is set manually**, not calculated from progress,
  overdue milestones, or open issues. Two projects in identical trouble can
  show different health if a Lead forgot to update the field. A centralized
  health engine is Stage 2.
- **Planned progress needs a start date.** `getPlannedProgress()` genuinely
  calculates it from each project's `startDate`/`targetDate` — but **17 of
  the 20 seeded projects don't have a `startDate`**, so most of the
  portfolio will show "Planned progress unavailable" rather than a number
  until those dates are filled in. This is the correct, honest behaviour,
  not a bug to patch over with an invented date.
- **"My projects" is ID-based** (`project.leadId === user.id`, resolved
  through `src/data/users.ts`), not name-matching — but the only
  login-capable Lead account doesn't currently own any seeded project, so
  "My projects" for that account is correctly empty. See `docs/roadmap.md`.
- **Per-stage budgets are not tracked**; the "Budget by phase" card shows an
  indicative split of the awarded value and is labelled as such in the UI.
- **Progress has one source of truth today (the overall number), not the
  phases.** Phase-weighted progress, where the overall number is derived
  from weighted phase progress instead of set independently, is Stage 2.
- The main JS bundle is ~145 kB gzipped. Route-level code splitting would
  reduce first paint if this ever ships externally.

**[`notes.md`](./notes.md)** covers the architecture behind each of these
in depth; **[`docs/roadmap.md`](./docs/roadmap.md)** covers what closing
them looks like, staged.
