# Encalm Project Dashboard

Internal project-control dashboard for Encalm Hospitality: portfolio health, stage
progress, milestones, issues and risks, commercial position, and an update feed.

**React 19 · TypeScript · Vite 7 · Tailwind CSS v4 · wouter · shadcn/ui**

There is no backend and no database. Projects are seeded from
`src/data/projects.ts`; anything you change is persisted to your browser's
`localStorage` and stays on that machine.

---

## 1. Prerequisites

| Requirement | Version | Check |
| --- | --- | --- |
| Node.js | **20.19+ or 22.12+** (Vite 7 requires it) | `node -v` |
| npm | 10+ (ships with Node) | `npm -v` |
| Git | any recent | `git --version` |
| VS Code | any recent | — |

Download Node from [nodejs.org](https://nodejs.org). If you juggle versions, use
`nvm use 22`.

### Recommended VS Code extensions

Opening the folder prompts you to install these (they're listed in
`.vscode/extensions.json`):

| Extension | ID | Why |
| --- | --- | --- |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Class autocomplete for the v4 theme |
| ESLint | `dbaeumer.vscode-eslint` | Inline lint feedback |
| Prettier | `esbenp.prettier-vscode` | Format on save (already enabled in settings) |

---

## 2. Setup and run

```bash
# 1. install dependencies
npm install

# 2. (optional) create your local env file
cp .env.example .env.local

# 3. start the dev server
npm run dev
```

Open <http://localhost:5173>.

### Environment variables

`.env.local` is git-ignored and entirely optional — every value has a working
default. Only `VITE_`-prefixed variables reach the browser bundle, so **never put
a secret in one**; they are readable by anyone who opens the site.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5173` | Dev and preview server port |
| `BASE_PATH` | `/` | Set this if serving from a sub-folder, e.g. `/dashboard/` |
| `VITE_APP_NAME` | `Encalm Projects` | Display name |
| `VITE_ORG_NAME` | `Encalm Hospitality` | Organisation name |

### Signing in

The sign-in screen is a prototype role picker, not real authentication. **Any
non-empty password works**; the email decides the role.

| Email | Role | Access |
| --- | --- | --- |
| `hod@encalm.com` | Project HOD (Ruchika Chauhan) | Read-only across the whole portfolio |
| `lead@encalm.com` | Project Lead (Chinmay Saxena) | Can create and edit projects |

---

## 3. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-checks nothing, bundles to `dist/` |
| `npm run typecheck` | Full TypeScript check, emits nothing |
| `npm run preview` | Serves the production build on `PORT + 1` |

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
  data/projects.ts       Seed data, domain types, formatters
  state/app-state.tsx    Auth role, project state, persistence, RBAC
  lib/
    storage.ts           localStorage access that never throws
    date.ts              Date parsing/formatting that never throws
    utils.ts             `cn()` class merger
  pages/                 dashboard · workspace · project-detail · login · not-found
  components/
    app-shell.tsx        Sidebar, header, settings dialog
    error-boundary.tsx   Route-level error recovery
    ui/                  shadcn/ui primitives
  hooks/                 use-toast · use-mobile
```

### Things you'll likely change

- **Projects and seed data** → `src/data/projects.ts`
- **Colours, fonts, theme tokens** → `src/index.css` (`:root` block)
- **Navigation items** → `src/components/app-shell.tsx`
- **Routes** → `src/App.tsx`
- **Who can edit** → `EDITOR_ROLES` in `src/state/app-state.tsx`

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

`npm run build` produces a static `dist/` folder.

- **Netlify** — drag `dist/` in, or connect the repo with build command
  `npm run build` and publish directory `dist`
- **Vercel / Cloudflare Pages** — same build command and output directory
- **Any static host** — serve `dist/` with a SPA rewrite so unknown paths fall
  back to `index.html`, otherwise deep links like `/project/xyz` 404

---

## 8. Known limitations

- Sign-in is a role picker, not authentication. Do not expose this to the public
  internet with real project data.
- All data lives in one browser. Nothing is shared between users or devices, and
  clearing site data loses local edits.
- Per-stage budgets are not tracked; the "Budget by phase" card shows an
  indicative split of the awarded value and is labelled as such.
- The main JS bundle is ~145 kB gzipped. Route-level code splitting would reduce
  first paint if this ever ships externally.
