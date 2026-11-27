# Encalm Projects: Handover and Maintenance Guide

For whoever looks after **Encalm Projects** (the project dashboard at <https://projects.encalmhospitality.com>) from now on.

- **Part A** is for the **business owner**: what the app is, what it needs from you, simple routine checks and who to call. No technical knowledge needed.
- **Part B** is for **IT**: technology, deployment, making changes, backups, health checks and troubleshooting.

The full technical detail is in **[PRODUCTION.md](../PRODUCTION.md)** (section 15 is the Plesk server we use); how to use the app is in **[USER_MANUAL.md](USER_MANUAL.md)**.

> **Never** put passwords, keys or secrets in this document, in Git, in chat or in email. They belong in the company password manager. Wherever this guide mentions a secret, that is where the value lives.

---

## Contents

**Part A: For the business owner**

- [A1. What the app is](#a1-what-the-app-is)
- [A2. Who uses it](#a2-who-uses-it)
- [A3. What it runs on](#a3-what-it-runs-on)
- [A4. Your responsibilities](#a4-your-responsibilities)
- [A5. Simple routine checks](#a5-simple-routine-checks)
- [A6. When to call IT](#a6-when-to-call-it)
- [A7. Contacts](#a7-contacts)
- [A8. Important dates and renewals](#a8-important-dates-and-renewals)

**Part B: Technical guide for IT**

1. [At a glance](#1-at-a-glance)
2. [Technology used](#2-technology-used)
3. [How it runs](#3-how-it-runs)
4. [Where things live](#4-where-things-live)
5. [Accounts and access you need](#5-accounts-and-access-you-need)
6. [Making a change](#6-making-a-change)
7. [Deploying to the live server](#7-deploying-to-the-live-server)
8. [Rolling back](#8-rolling-back)
9. [Database changes](#9-database-changes)
10. [Server settings (.env)](#10-server-settings-env)
11. [Users and passwords](#11-users-and-passwords)
12. [Email](#12-email)
13. [Backups and restore](#13-backups-and-restore)
14. [Regular health checks](#14-regular-health-checks)
15. [Troubleshooting](#15-troubleshooting)
16. [Open items at handover](#16-open-items-at-handover)
17. [Handover checklist](#17-handover-checklist)

---

# Part A: For the business owner

## A1. What the app is

**Encalm Projects** is Encalm Hospitality's internal website for tracking every project from brief to opening: progress of each stage, target dates, milestones and approvals, issues and risks, budget (AOP) and spend, site photographs and team updates. Management sees the whole portfolio on one screen; Project Leads keep their own projects up to date.

- Address: <https://projects.encalmhospitality.com>
- People sign in with their work email and a password of their own.
- Progress bars are colour-coded: **green** ahead of schedule or complete, **yellow** on track, **red** delayed, overdue or blocked.
- A tutorial video and the user manual explain how to use it.

## A2. Who uses it

| Role | Who | Can do |
|---|---|---|
| **Project Coordinator** | PMO / project management team, Vice President | Everything: all projects, add Project Leads, allot projects, approvals, settings, backups |
| **Project Lead** | Person responsible for a project | Update their own projects: stages, milestones, photos, issues, updates |
| **HOD** | Heads of department | See everything, tag people, receive critical-issue alerts |
| **Viewer** | Management / others who only need to look | See everything, change nothing |

Coordinators add and remove people in the app (**Team & Allotment**). Only IT can create coordinator, HOD and viewer accounts.

## A3. What it runs on

| Item | Detail | Who looks after it |
|---|---|---|
| Server | A Windows server rented from **GoDaddy**, managed with **Plesk** | IT |
| Web address | `projects.encalmhospitality.com` (domain registered with GoDaddy) | IT |
| Email | Sent through the company's **Microsoft 365** | Encalm IT |
| Code | Stored on **GitHub** (`digitalintern123/Project-Dashboard`) | IT / developer |
| Data | One database file on the server, backed up automatically every night | IT |

The same server also hosts other Encalm sites (dashboard, tracker, Employee Hub).

## A4. Your responsibilities

As the business owner you do not need to touch the server or the code. You decide and approve:

1. **Who has access**, and at which role. Ask a coordinator to remove people who leave or change role.
2. **Changes and new features**: agree what should change and approve before IT releases it.
3. **Renewals and payments**: GoDaddy server and domain, Microsoft 365 (section A8).
4. **That backups are taken** and that IT can restore them (ask IT once a quarter).
5. **That the handover is complete**: the checklist in Part B, section 17.

## A5. Simple routine checks

| How often | What to do (no technical knowledge needed) | All good when |
|---|---|---|
| **Daily** | Open <https://projects.encalmhospitality.com> | The sign-in page or dashboard appears |
| **Weekly** | As a coordinator: **Settings (gear icon) → Server backups** | "Last backup" is within the last day |
| | Look at the dashboard: are leads updating their projects? | Projects show recent updates; red bars are being followed up |
| | **Envelope icon (top right) → Outbox & Delivery Logs** | No new emails marked **Failed** |
| **Monthly** | **Team & Allotment**: review the people list | Everyone listed still needs access, with the right role |
| | Ask IT: "Were security updates and off-site backups done?" | IT confirms |
| **Quarterly** | Ask IT to test restoring a backup | IT confirms it worked |
| **Yearly** | Check renewal dates (section A8) | Nothing expires in the next 3 months |

## A6. When to call IT

Call IT straight away if:

- the site does not open for **several people** (one person only is usually their own network or a mistyped password);
- everyone sees an **error page** (for example "500");
- **data looks wrong or missing**;
- emails from the app have stopped arriving;
- you suspect someone has **unauthorised access** or a password was shared.

Tell IT: what you saw (a photo of the screen helps), when it started, and who is affected. **Never send passwords** in the message.

Not an emergency, the user can fix it: "Invalid email or password" (check the spelling of the email; after 5 wrong tries wait 15 minutes; a coordinator can reset the password in **Team & Allotment**).

## A7. Contacts

Fill in and keep up to date.

| Role | Name | Phone / email |
|---|---|---|
| Business owner | | |
| IT / app maintainer | | |
| Backup IT contact | | |
| Microsoft 365 admin (Encalm IT) | Prasenjit Baidya, Manager IT | |
| GoDaddy account holder | | |
| Developer (code changes) | | |

## A8. Important dates and renewals

Fill in with IT. Missing one of these can take the app offline or stop emails.

| What | Renewal / expiry date | Owner |
|---|---|---|
| GoDaddy server | | |
| Domain `encalmhospitality.com` | | |
| SSL certificate (the padlock) | Renews automatically every 90 days; IT checks | IT |
| Microsoft 365 app secret (email) | Usually every 24 months | Encalm IT |
| Plesk licence | | |

---

# Part B: Technical guide for IT

## 1. At a glance

| Item | Detail |
|---|---|
| **Live site** | <https://projects.encalmhospitality.com> |
| **Is it up?** | <https://projects.encalmhospitality.com/api/system/ready> shows `{"status":"ready"}` |
| **Which version is live?** | <https://projects.encalmhospitality.com/api/client-config>: `release` = first 8 characters of the Git commit |
| **Code** | GitHub `digitalintern123/Project-Dashboard` |
| **Branches** | `main` = source code. `plesk-release` = ready-to-run build, made automatically by GitHub; this is what the server runs. |
| **Server** | GoDaddy Windows server with **Plesk**, IP `97.74.93.38`, IIS + iisnode |
| **Domain DNS** | GoDaddy (name servers `ns45` / `ns46.domaincontrol.com`); `projects` → `97.74.93.38` |
| **Database** | SQLite file `encalm.db` in the server's data folder |
| **Email** | Microsoft 365 via Microsoft Graph (Azure app registration) |

**Golden rules**

1. Never delete or replace the live data folder (`encalm-data`) or `encalm.db`. Database changes go through **migrations** only (section 9).
2. Never build on the server. GitHub builds; the server only pulls `plesk-release`.
3. Every change goes through `main` with CI green before it reaches the server.
4. Click **Back up now** (Settings → Server backups) before every update.
5. Run only **read-only** commands on the live database unless you have a fresh backup and know exactly what the command changes.

---

## 2. Technology used

| Layer | Technology | Version | What it does |
|---|---|---|---|
| Language | **TypeScript** | 5.9 | Whole codebase, front end and server |
| Front end | **React** | 19 | User interface |
| | **Vite** | 7 | Development server and production build of the web app |
| | **Tailwind CSS** | 4 | Styling |
| | Radix UI / shadcn-style components, **lucide-react** icons | | Dialogs, menus, icons |
| | **TanStack Query**, **wouter** | 5, 3 | Data loading and page routing |
| | **Recharts** | 2 | Charts |
| Server | **Node.js** | 22 | Runtime |
| | **Express** | 5 | Web server and REST API (`/api/...`); also serves the built web app |
| | **zod** | 4 | Validates every request |
| | **helmet**, **express-rate-limit**, **cookie-parser** | | Security headers, rate limits, session cookies |
| | **jsonwebtoken**, **bcryptjs** | | Sign-in sessions (httpOnly cookies, refresh rotation), password hashing |
| | **multer**, **sharp** | | Photo uploads and image processing |
| | **nodemailer**, Microsoft Graph API | | Sending email (Graph first, SMTP as fallback) |
| | **pino** | 9 | Structured JSON logs |
| | **Sentry** (optional) | 10 | Error reporting, off unless `SENTRY_DSN` is set |
| Database | **SQLite** via **better-sqlite3** | 13 | Single-file database, WAL mode, versioned SQL migrations |
| Hosting | Windows Server, **IIS** + **iisnode**, **Plesk** | | iisnode starts `server.cjs` and passes it a named pipe |
| Quality | **Vitest**, Testing Library, **Playwright**, ESLint, Prettier, husky | | Unit/API/web tests, end-to-end tests, lint and format, pre-commit hook |
| CI/CD | **GitHub Actions** | | `ci.yml` (checks), `plesk-release.yml` (builds the server branch) |

Other files you may see: `Dockerfile`, `docker-compose.yml`, `deploy/` and `scripts/*.sh` are for an alternative **Linux** setup (PRODUCTION.md sections 2–14). They are **not** used on the Plesk server. `notes.md` describes an early, browser-only prototype and is out of date.

---

## 3. How it runs

```
Developer ──push──▶ GitHub main ──▶ CI (lint, types, tests, build, audit)
                                      │ green
                                      ▼
                              "Plesk release" workflow
                    builds the app, smoke-tests it, commits the
                    ready-to-run files to the  plesk-release  branch
                                      │
             Plesk → Git → Pull Updates (manual click, or webhook)
                                      ▼
Browser ──HTTPS──▶ IIS ──web.config──▶ iisnode ──▶ server.cjs (Node 22, Express)
                                                    ├─ serves the web app (dist/)
                                                    ├─ REST API /api/...
                                                    ├─ SQLite encalm.db + uploads/
                                                    ├─ daily backups (02:15)
                                                    └─ email → Microsoft Graph
```

- The app runs as **one Node process** (`iisnode.yml`: `nodeProcessCountPerApplication: 1`; do not raise it, SQLite needs a single writer).
- **Migrations run automatically** when the app starts.
- Deploying a new `plesk-release` commit restarts the app by itself (iisnode watches `SOURCE_COMMIT`).

---

## 4. Where things live

### On the server

| What | Where |
|---|---|
| Application (the `plesk-release` files) | `C:\Inetpub\vhosts\projects.encalmhospitality.com\httpdocs` |
| Server secrets and settings | `httpdocs\.env` (blocked from download by `web.config`) |
| **Data (never delete)** | `C:\Inetpub\vhosts\projects.encalmhospitality.com\encalm-data` → `encalm.db` (+ `-wal`/`-shm`), `uploads\` (photos) |
| Automatic backups | `encalm-data\backups\` (`encalm-<UTC time>.db.gz`, `uploads\`) |
| App start-up / crash logs | `httpdocs\iisnode\` (newest file) |
| Node.js used by Plesk | Found with the `$node = …` line in section 15 |

Other sites on the same server (not part of this app; don't touch them): `dashboard.encalmhospitality.com`, `tracker.encalmhospitality.com`, *Encalm Employee Hub*, *EncalmAnalytics* (stopped).

### In the repository

| Folder / file | Contents |
|---|---|
| `src/` | Web app (React). `features/` = screens (dashboard, project-detail, workspace, area-sheet), `components/`, `lib/` (helpers, e.g. `progress-tone.ts` for bar colours), `state/` (app state), `__tests__/` |
| `server/src/` | API. `routes/` (one file per area), `repositories/` (database queries), `services/` (email, backups, notifications), `db/migrations/` (schema), `scripts/` (create-user, restore-backup, migrate) |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | This guide, `USER_MANUAL.md`, `video/` (tutorial video tooling and script) |
| `.github/workflows/` | `ci.yml`, `plesk-release.yml`, `deploy.yml` (Linux only) |
| `.env.example` | Every setting with an explanation |
| `PRODUCTION.md` | Full runbook |

---

## 5. Accounts and access you need

Get these handed over before the previous maintainer leaves. Store every credential in the password manager.

| Access | Used for | Who grants it |
|---|---|---|
| **GitHub** repository (write, ideally admin) | Changes, Actions, `plesk-release` | Repository owner (`digitalintern123`) |
| **Plesk** login for the domain | Git → Pull Updates, Node.js → Restart App, Backup Manager, SSL | IT / server admin |
| **RDP or Plesk PowerShell** on the server | Read-only database checks, user creation, restore | IT / server admin |
| **GoDaddy** account | Server billing/support, DNS for `encalmhospitality.com` | IT |
| **Microsoft 365 / Azure** admin (or contact) | Azure app "Encalm Projects", client secret renewal, shared mailbox | Encalm IT (currently Prasenjit Baidya, Manager IT) |
| A **coordinator** account in the app | Settings, backups, team, audit log | An existing coordinator |
| Password manager entries | `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, Azure client secret + expiry date | Previous maintainer |

The shared login `digital.intern@encalm.com` shows as **Praveen Pal** in the app. If several people use it, the audit log cannot tell them apart: give each maintainer their own coordinator account.

---

## 6. Making a change

### One-time setup on your computer

Requires Node.js **22** and Git.

```bash
git clone https://github.com/digitalintern123/Project-Dashboard.git
cd Project-Dashboard
npm install
npx husky                 # enables the pre-commit check
cp .env.example .env      # optional; development has defaults
npm run dev               # API on :5000, web on http://localhost:5173
```

The first start creates sample accounts and prints their temporary passwords **once** in the terminal. Local data is in `server/data/` (git-ignored, never the live data).

### Every change

1. **Branch:** `git checkout -b short-description`
2. **Change** the code. Match the style around it.
3. **Test it** before committing; these are the same checks CI runs:
   ```bash
   npm run lint
   npm run format:check
   npm run typecheck
   npm test
   npm run build
   ```
   Add or update a test for what you changed (`src/__tests__/` for screens, `server/test/` for the API).
4. **See it working:** `npm run dev`, try the change in the browser as the roles it affects (coordinator, lead, viewer).
5. **Commit and push**, open a pull request into `main`, wait for **CI** to go green, merge.
6. **Deploy** (section 7).

Keep changes small: one feature or fix per pull request makes problems easy to find and roll back.

---

## 7. Deploying to the live server

Merging into `main` does **not** change the live site by itself. Steps:

1. **Wait for GitHub:** repository → **Actions**. First **CI** must pass on `main`, then **Plesk release** runs and finishes green (a few minutes). If you need it again, open *Plesk release* → **Run workflow**.
2. **Back up:** in the app, **Settings → Server backups → Back up now**.
3. **Pull:** Plesk → *projects.encalmhospitality.com* → **Git** → **Pull Updates** (and **Deploy Now** if deployment is *Manual*). Branch must be **`plesk-release`**.
4. **Install packages** only if `package.json` changed: Plesk → **Node.js** → **NPM install**. If it says `EPERM`, click **Disable Node.js**, install, then **Enable Node.js**.
5. **Restart:** Plesk → Node.js → **Restart App** (or touch `web.config`, below).
6. **Verify:**
   - `/api/system/ready` shows `{"status":"ready"}`;
   - `/api/client-config` shows the new `release` (first 8 characters of the `main` commit);
   - sign in and check the screen you changed; press **Ctrl + F5** if the browser shows the old version.

Restart from the server's PowerShell instead of the Plesk button:

```powershell
cd C:\Inetpub\vhosts\projects.encalmhospitality.com\httpdocs
(Get-Item .\web.config).LastWriteTime = Get-Date
```

---

## 8. Rolling back

If something is wrong after an update:

1. Plesk → **Git** → deploy the **previous commit** of `plesk-release`, then **Restart App**.
2. Check `/api/client-config` shows the old `release`.
3. Only if the bad update **changed the database** (it added a migration) and data looks wrong: restore the backup you took before updating (section 13).
4. Fix the problem on a branch, then release again through `main`.

---

## 9. Database changes

- The schema lives in `server/src/db/migrations/` as numbered SQL files (`001_initial.sql` … `007_directory_stakeholders.sql`).
- To change the schema, **add a new file** with the next number, e.g. `008_add_project_region.sql`. Never edit or delete a migration that has already run on the server.
- Each migration runs once, in a transaction, when the app starts, and is recorded in `schema_migrations`.
- Write migrations that keep existing data (`ALTER TABLE … ADD COLUMN`, create-copy-rename for bigger changes). Test against a copy of real data before release.
- Never delete, reset or hand-edit the live `encalm.db`. The `POST /api/system/reset` and `/clear` endpoints are refused in production; keep it that way (`ALLOW_SYSTEM_RESET` stays unset).

**Reading the live database safely** (read-only; paste into PowerShell on the server):

```powershell
cd C:\Inetpub\vhosts\projects.encalmhospitality.com\httpdocs
$node = Get-ChildItem 'C:\Program Files*\Plesk\Additional\NodeJs', 'C:\Program Files\nodejs', "$env:plesk_dir\Additional\NodeJs" -Recurse -Filter node.exe -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
@'
const Database = require('better-sqlite3');
const db = new Database('C:/Inetpub/vhosts/projects.encalmhospitality.com/encalm-data/encalm.db', { readonly: true });
console.table(db.prepare('SELECT name, email, role, title FROM users ORDER BY role, name').all());
'@ | & $node -
```

Change only the SQL inside `db.prepare('…')`. `{ readonly: true }` guarantees the command cannot change anything.

---

## 10. Server settings (.env)

`httpdocs\.env` on the server. Names only here; values are in the password manager. Every setting is explained in `.env.example`.

| Setting | Purpose |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Signs sign-in sessions. Changing it signs everyone out. |
| `SETTINGS_ENCRYPTION_KEY` | Encrypts stored email secrets. Required; without it the app will not start. |
| `APP_BASE_URL` | `https://projects.encalmhospitality.com` (links in emails) |
| `DATA_DIR` | The data folder (section 4) |
| `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET` | Azure app for Microsoft 365 email |
| `MS_GRAPH_SEND_AS_DOMAINS` | `encalm.com`: these users send from their own mailbox |
| `MS_GRAPH_SENDER_EMAIL` | Shared mailbox for everyone else (see section 16) |
| `BACKUP_TIME`, `BACKUP_RETENTION_DAYS`, `BACKUP_DIR` | Optional backup schedule overrides |
| `SENTRY_DSN` | Optional error reporting |

Do **not** set `PORT`, `HOST` or `API_PORT` on Plesk (iisnode supplies the pipe). After any change to `.env`, restart the app (section 7, step 5).

---

## 11. Users and passwords

| Role | Can |
|---|---|
| `coordinator` | Everything: edit every project, team & allotment, approvals, email settings, backups |
| `lead` | Edit own and unassigned projects; tag and email on them |
| `hod` | View everything; tag people; receives critical-issue alerts |
| `viewer` | View only |

- **Add a Project Lead / reset a lead's password:** in the app, **Team & Allotment**. The temporary password is shown once; give it to the person privately (never by screenshot or group chat).
- **Other roles** (coordinator, HOD, viewer): `create-user` on the server, see PRODUCTION.md section 12 (Plesk command included). Running it again for an existing email updates the role and password.
- Every new or reset password must be changed at first sign-in. Minimum 10 characters with letters and numbers.
- **Five wrong passwords lock the account for 15 minutes.** A misspelt email (e.g. `enclam.com`) gives the same "Invalid email or password" message.
- Role changes take effect on the user's next request; no sign-out needed.
- Who changed what: the **audit log**, `https://projects.encalmhospitality.com/api/system/audit?limit=200` while signed in as a coordinator.

---

## 12. Email

- Users with an `@encalm.com` address send **from their own mailbox** (Microsoft Graph); a copy appears in their Outlook *Sent Items*.
- Everyone else (e.g. external coordinators such as Knight Frank) sends from the shared mailbox in `MS_GRAPH_SENDER_EMAIL`, shown as "*Name* via Encalm Projects", with replies going to that person.
- External users do **not** need their own SMTP. The SMTP fields in the app's Email Settings are one setting for everyone and are ignored while Microsoft 365 is connected.
- Delivery status: the **✉** icon (top right) → **Outbox & Delivery Logs**. Failed items can be resent there.
- The Azure **client secret expires** (normally after 24 months). Renew it before the date in the password manager, update `MS_GRAPH_CLIENT_SECRET`, restart. Expired secret = no emails.

Details: PRODUCTION.md section 12.1.

---

## 13. Backups and restore

- **Automatic:** every day at 02:15 server time the app writes `encalm-data\backups\encalm-<UTC>.db.gz` (integrity-checked) and copies new photos. Kept 30 days, newest 7 always kept. Status and **Back up now**: Settings → Server backups.
- **Off the server (required):** Plesk → **Backup Manager → Remote Storage Settings**, daily, remote storage, keep ≥ 14 copies, whole domain (includes `encalm-data\backups`). A backup on the same disk does not survive losing the server.
- **Never** copy `encalm.db` by hand while the app runs.
- **Restore:** Plesk → Node.js → **Disable Node.js**, then in PowerShell in `httpdocs`:
  ```powershell
  & $node server\dist\restore-backup.js ..\encalm-data\backups\encalm-<stamp>.db.gz
  ```
  then **Enable Node.js** → **Restart App**. The current database is renamed `*.before-restore-<time>`, not deleted. Full steps: PRODUCTION.md 15.8.

---

## 14. Regular health checks

| How often | Check | How | Healthy when |
|---|---|---|---|
| **Continuously** (set up once) | Uptime alert | UptimeRobot (free): keyword monitor on `/api/system/ready`, keyword `ready`, every 5 min, email alert | You get an email within minutes if the site goes down |
| **Daily** (1 min) | Site is up | Open `/api/system/ready` | `{"status":"ready"}` |
| | Email is going out | ✉ → Outbox & Delivery Logs | No new **Failed** items |
| **Weekly** (10 min) | Backups ran | Settings → Server backups | Last backup < 24 h old |
| | Errors | Newest file in `httpdocs\iisnode\`; Sentry if set up | No repeated errors |
| | Usage | Audit log / who-updated query (section 9) | Leads are updating their projects; follow up with those who are not |
| | Disk space | `Get-PSDrive C` on the server | > 20% free |
| **Monthly** (30 min) | Off-site backup | Plesk Backup Manager → remote storage | Recent copies exist |
| | Security updates for packages | On your computer: `npm audit`; CI also fails on high-severity issues | No high/critical issues (fix with `npm audit fix`, test, release) |
| | Users | Team & Allotment, users query | Leavers removed, roles correct, no shared logins |
| | Windows updates | Server admin / GoDaddy | Installed; app restarted and `/ready` OK afterwards |
| **Quarterly** (1 h) | Test a restore | `npm run test:backup` locally, and restore one recent backup to a **copy** (never over live data) | Restore succeeds and data looks right |
| | Dependency updates | `npm outdated`; update in small steps on a branch, full tests | App works, CI green |
| | SSL certificate | Plesk → SSL/TLS Certificates | Let's Encrypt auto-renews; expiry > 30 days away |
| | Secret expiry | Password manager | Azure client secret not expiring within 3 months |
| **Yearly** | Node.js version | Plesk Node.js page; CI uses Node 22 | Still a supported (LTS) version; plan upgrades together with CI |
| | Domain and server renewal | GoDaddy | Auto-renew on, payment valid |
| | Review this guide | | Still accurate; update it in the same pull request as any process change |

---

## 15. Troubleshooting

| Symptom | Likely cause | First step |
|---|---|---|
| **"This site can't be reached" / ERR_CONNECTION_TIMED_OUT** for some users | Their network or firewall, not the app | Check `/ready` from the server (`curl.exe -s https://projects.encalmhospitality.com/api/system/ready`). If OK there, test on a phone with mobile data; ask the user's IT to allow `97.74.93.38` on ports 80/443. |
| **500 error** for everyone | App failed to start (missing setting, permissions, wrong branch) | Newest log in `httpdocs\iisnode\`; table in PRODUCTION.md 15.6 |
| New version deployed but old behaviour | App not restarted | Touch `web.config`; check `/api/client-config` `release` |
| User can't sign in | Misspelt email, wrong/old password, 15-min lock | Check the user row (section 9 query with `failed_attempts`, `locked_until`); reset in Team & Allotment |
| Emails not arriving | Azure secret expired, mailbox missing, recipient blocked | ✉ → Outbox & Delivery Logs for the error; section 12 |
| "Unassigned" lead names, missing data after update | Front end and server out of step, or a bug | Ctrl + F5; roll back (section 8) if it started after an update |
| Server disk full | Old backups or logs | Check `encalm-data\backups` and `httpdocs\iisnode`; never delete `encalm.db` |

**Incident order:** is it down → what changed (last deploy) → if it started after a deploy, **roll back first, investigate second** → logs → write down what happened and the fix.

Useful read-only server checks:

```powershell
curl.exe -s -o NUL -w "http %{http_code}`n"  https://projects.encalmhospitality.com/api/system/ready
Import-Module WebAdministration; Get-Website | Where-Object Name -like '*projects*' | Format-Table Name, State
Get-ChildItem C:\Inetpub\vhosts\projects.encalmhospitality.com\httpdocs\iisnode | Sort-Object LastWriteTime | Select-Object -Last 1 | Get-Content -Tail 40
```

---

## 16. Open items at handover

| Item | Status / next step |
|---|---|
| **Shared mailbox for non-Encalm senders** | `MS_GRAPH_SENDER_EMAIL` is not set, so it defaults to `notifications@encalm.com`, which does not exist. Emails from external users (e.g. Knight Frank) fail. Create a shared mailbox in Microsoft 365, set `MS_GRAPH_SENDER_EMAIL` in `.env`, restart. |
| **Off-site backups** | Confirm Plesk Backup Manager sends daily copies to remote storage. |
| **Uptime monitoring** | Set up UptimeRobot (section 14) if not done. |
| **Shared `digital.intern` login** | Give each maintainer their own account. |
| **Tutorial video voiceover** | Silent preview done; voiceover with the cloned voice is pending. Tooling and steps: `docs/video/README.md`. Never commit audio or API keys. |
| **Self-service password change** | Users can only change their password at first sign-in or after a reset. |

---

## 17. Handover checklist

- [ ] GitHub access given; new maintainer can see **Actions** and run *Plesk release*.
- [ ] Plesk login and server PowerShell/RDP access given.
- [ ] Password manager holds: `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`, Azure tenant/client IDs, client secret **and its expiry date**, Plesk and GoDaddy logins.
- [ ] New maintainer has their own **coordinator** account.
- [ ] New maintainer ran the app locally (`npm run dev`) and all checks pass.
- [ ] One practice release done together: small change → `main` → Plesk release → Pull Updates → verify `/api/client-config`.
- [ ] Backup restore practised on a copy.
- [ ] Uptime monitor alerts go to the new maintainer.
- [ ] Open items (section 16) reviewed and assigned.
