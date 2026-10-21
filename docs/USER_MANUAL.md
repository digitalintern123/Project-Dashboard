# Encalm Projects — User Manual

**App:** https://projects.encalmhospitality.com
**For:** Project Coordinators, Project Leads, HODs, Viewers, and the IT admin who runs the server.

This manual follows the life of a project through the app, stage by stage: getting in, finding your way around, creating a project, planning it, tracking milestones and issues, posting updates and tagging people, photos, money, reporting, and finally administration. Button and screen names are written exactly as they appear in the app, in **bold**.

---

## Contents

0. [Roles: who can do what](#0-roles-who-can-do-what)
1. [Stage 1 — Getting in](#stage-1--getting-in)
2. [Stage 2 — Finding your way around](#stage-2--finding-your-way-around)
3. [Stage 3 — Portfolio overview (dashboard)](#stage-3--portfolio-overview-dashboard)
4. [Stage 4 — Creating a project](#stage-4--creating-a-project)
5. [Stage 5 — The project page](#stage-5--the-project-page)
6. [Stage 6 — Planning: stages, timeline and progress](#stage-6--planning-stages-timeline-and-progress)
7. [Stage 7 — Milestones and approvals](#stage-7--milestones-and-approvals)
8. [Stage 8 — Issues and risks](#stage-8--issues-and-risks)
9. [Stage 9 — Stage updates and @mentions](#stage-9--stage-updates-and-mentions)
10. [Stage 10 — Tagging people and email](#stage-10--tagging-people-and-email)
11. [Stage 11 — Site photographs](#stage-11--site-photographs)
12. [Stage 12 — Commercials, area program and area sheet](#stage-12--commercials-area-program-and-area-sheet)
13. [Stage 13 — Notifications](#stage-13--notifications)
14. [Stage 14 — Reporting and executive updates](#stage-14--reporting-and-executive-updates)
15. [Stage 15 — Coordinator administration](#stage-15--coordinator-administration)
16. [Stage 16 — Server administration (IT / Plesk)](#stage-16--server-administration-it--plesk)
17. [Troubleshooting and FAQ](#troubleshooting-and-faq)
18. [Known limitations](#known-limitations)
19. [Quick reference cards](#quick-reference-cards)

---

## 0. Roles: who can do what

Every account has one role. Your role is shown as a pill at the top of the screen: **Project coordinator**, **Project lead**, **Project HOD · Read-only** or **Viewer · Read-only**.

| Action | Coordinator | Lead | HOD | Viewer |
|---|:-:|:-:|:-:|:-:|
| See every project, dashboard, reports, photos | ✅ | ✅ | ✅ | ✅ |
| Create a project | ✅ | ✅ | — | — |
| Edit a project (stages, milestones, issues, updates, photos, commercials) | ✅ all projects | ✅ own or unassigned projects only | — | — |
| Delete a project | ✅ | — | — | — |
| Approve / reject milestones | ✅ | — | — | — |
| Tag people and send them email | ✅ | ✅ on projects they can edit | ✅ any project | — |
| Send an Executive Update email | ✅ | ✅ own projects | ✅ | — |
| Receive critical-issue and approval emails | ✅ | — | ✅ (critical issues) | — |
| Create Project Leads, reset passwords, allot projects | ✅ | — | — | — |
| Email Hub (outbox, settings), server backups | ✅ | — | — | — |

- **HOD** = oversight. Sees everything, cannot change project data, but can tag people and email them, and gets critical-issue alerts.
- **Viewer** = strictly look-only. No editing, no tagging, no email, no alerts.
- The server enforces these rules. Hiding a button is only a convenience; even if someone tried to call the server directly, it would refuse.

---

## Stage 1 — Getting in

### 1.1 Signing in
1. Open https://projects.encalmhospitality.com.
2. On **Welcome back**, enter your **Email** (e.g. `name@encalm.com`) and **Password**. Use the eye icon to **Show password**.
3. Click **Sign in**.

If it fails you see *"Invalid email or password. After repeated failed attempts, sign-in is paused for 15 minutes."*

### 1.2 Lockout
- **5 wrong passwords** on one account → that account is paused for **15 minutes**.
- **10 attempts from one network in 15 minutes** → *"Too many sign-in attempts from this network…"*. Wait 15 minutes.
- A successful sign-in resets the counter.

### 1.3 First sign-in: set your own password
New accounts get a temporary password. After signing in you see **Set a new password**:
1. **Current password** — the temporary one.
2. **New password** and **Confirm new password**. Rules: at least **10 characters**, with **both letters and numbers**, and different from the current one.
3. Click **Update password and continue**.

You cannot use the app until this is done. Changing the password signs you out everywhere else.

### 1.4 Staying signed in / signing out
- You stay signed in for up to **7 days** of inactivity on that browser.
- To sign out: **Logout** at the bottom of the left sidebar (expand the sidebar if it is collapsed).
- **Forgot your password?** There is no self-service reset. Ask a Coordinator (Team & Allotment → **Reset password**) or IT.

---

## Stage 2 — Finding your way around

### 2.1 Left sidebar
| Group | Items |
|---|---|
| Command center | **Portfolio overview** |
| Projects | **All projects**, **Project Area Sheet**, **New project** (leads, coordinators), **My projects** (leads), **Team & Allotment** (coordinators) |
| Execution | **Timeline**, **Milestones**, **Issues & risks**, **Update feed**, **Site photographs** |
| Commercial | **Budget & AOP** |
| Reports | **Project reports** |

The sidebar footer shows your name and title, the notifications bell, the connection dot (**Server Online** / **Syncing**) and **Logout**.

### 2.2 Top bar
- A breadcrumb (*Encalm Hospitality > section*) and your role pill.
- **Backend Active** / **Connecting** status.
- 🔔 **Notifications** (see Stage 13).
- ✉️ **Email Outbox & Delivery Radar** (coordinators only, see Stage 15).
- ⚙️ **Settings**.
- A button to collapse or expand the sidebar.

The app refreshes data by itself every **15 seconds**, so changes made by colleagues appear without reloading.

---

## Stage 3 — Portfolio overview (dashboard)

**Portfolio overview** is the home page.

- **Greeting** — a short summary of active projects and decisions needing attention. Leads see their own projects.
- **KPI cards**
  - **Active projects** — how many, across how many locations.
  - **Portfolio AOP** — total approved budget and how much is unspent (₹ Cr).
  - **Average progress** — how many projects are on track.
  - **Needs attention** — projects with a **High** severity issue.
- **Portfolio health** — a donut of On track / At risk / Delayed with the average completion.
- **Management attention** — up to 3 projects that are *At risk* or *Delayed*. If none: *"Nothing needs a decision this week."*
- **Search projects** — searches by name, location, category, code or lead.
- **Filters** → **Refine** — location (Delhi, Hyderabad, Goa, Bhogapuram, Vizag), category, status, health; **Clear** resets them.
- **Project register** — a table with Project, Status, Health, Progress, AOP, Spent and Target date. Click a row to open the project. **Expand full width** / **Standard view** changes the layout.
- **Next up** — the 4 nearest milestones, labelled *Overdue*, *This week*, *Next 30 days*, *Later* or *Date not set*.
- **Near completion** — the project closest to finishing.

**Status** values: Yet to start · In Design · In Tendering · Under Construction · Operational · On Hold.

**Health** values: On track · At risk · Delayed · Not started. Health is set by the project editor; it is not calculated.

---

## Stage 4 — Creating a project

*Leads and coordinators only.* Sidebar → **New project** (**Create new project**).

### Section 1 — Basic Information & Ownership
| Field | Notes |
|---|---|
| Project Name * | Required |
| Allot to Project Lead * | Coordinators only. A lead's own projects are allotted to them automatically. |
| Location * | Default: Delhi |
| Category * | Hotel, Lounge, Kitchen, Encalm Eats, Other |
| Initial Progress (%) | Usually 0 |
| Project Status * | See Stage 3 |
| Start Date * / Project Completion Date (Target) * | The target must be on or after the start date |

### Section 2 — Area, Capacity & Commercials
Fields: Area, Pax / Keys, **Approved Budget (AOP in ₹ Cr) \***, Committed Cost / Awarded, Projected Cost (blank = same as AOP), Scope Description. Money cannot be negative.

### Section 3 — Architectural Space Program (optional)
Tick **Enable Advanced Specifications** to record plot/site area, BUA, floor stacking, keys, bays, room size and elevators. **Open Detailed Tables Editor** lets you fill in the detailed tables.

### Create
Click **Create project**. The app:
- creates 5 standard stages: **Brief & scope** (current), **Design development**, **Procurement**, **Execution**, **Handover**;
- gives the project a code such as `DEL-NEW-26`;
- notifies everyone with *"New Project Created"*.

If something is missing, the form lists it under **Fix the following before creating the project**.

---

## Stage 5 — The project page

Open any project from the dashboard or **All projects**.

### 5.1 Header
- **Back to portfolio**, the code, location and category, and **Current delivery stage**.
- **Project status** — a dropdown if you can edit, otherwise plain text.
- **Current health** pill.
- **Email Update** — sends an Executive Update (Stage 14).
- If you can edit:
  - **Edit project** opens **Edit project information**: basics, timeline and next milestone, physical space, and commercial capital position. Save with **Save project**.
  - **Delete project** (coordinators only) asks *"Are you sure you want to permanently delete…"* → **Yes, delete project**. This cannot be undone, so make a backup first.
- If you cannot edit, a badge shows **View only · HOD Oversight**, **View only**, or **View only · Allotted to {lead}**.

### 5.2 Metric cards
- **Project Status**.
- **Completion %** — versus planned.
- **Approved Budget (AOP)** — with committed and spent; *(Over AOP)* when exceeded.
- **Projected Cost** — variance against budget.
- **Completion Date** — days remaining, *Due today*, or days past target.

### 5.3 Tabs
**Overview · Area Program** (hotels, or projects with a space program) **· Progress · Timeline · Milestones · Site Photograph (N) · Commercial · Issues & risks · Updates.** Each is explained in the stages below.

**Overview** shows the project information, phase progress, a **Project health** box (schedule, current stage, open issues, budget), the current site photograph and the key issue.

---

## Stage 6 — Planning: stages, timeline and progress

### 6.1 Timeline tab — *Stage control plan*
Each stage card shows:
- status (**Complete**, **Current stage**, **Blocked**, **Not started**) and owner;
- **Weight N%** and **+N% to overall**;
- a progress bar;
- **Completed / Next / Decision / Timeline**;
- **Budget**;
- **Assigned:** people, with a **Tag Member** button.

**Editors can:**
- **Update stage** — opens the stage editor:
  | Field | Meaning |
  |---|---|
  | Stage name, Owner | Who is responsible |
  | Status | Not started / In progress / Blocked / Complete |
  | Progress % | 0–100 |
  | Weight % (opt) | Share of the whole project. Leave blank to weight by duration. |
  | Budget (₹ Cr) | Phase budget |
  | Planned start / Planned finish / Actual finish | Dates |
  | Work completed | What is done |
  | Next action | What happens next |
  | Decision required | *"What decision or support is required from HOD?"* Filling this notifies everyone with **Decision Needed**. |

  Save with **Save stage update**.
- **Move** stages up or down, or **remove** one. A project must keep at least one stage.
- **Add custom stage** — name, owner, planned dates and optional weight → **Add**.

### 6.2 How project progress is calculated
The server recalculates **Completion %** automatically whenever a stage changes:
- If any stage has a **weight**, progress = Σ(stage progress × weight). Stages without a weight count as 1.
- Otherwise each stage counts by its **planned duration** in days.
- Otherwise all stages count equally.

### 6.3 Progress tab — *Weighted Project Progress*
A table of Stage / Timeline / Weight / Progress / Contribution with a **Total Project Delivery** row, plus planned vs actual and the variance.

Editors also get **Log progress note**: enter the next expected milestone and a status note, then **Save update note**. This is recorded as a Progress update.

---

## Stage 7 — Milestones and approvals

**Milestones** tab → *Milestones & approvals*, grouped into **Active & Upcoming** and **Completed Milestones**.

### 7.1 Adding a milestone (editors)
1. **Add milestone**: name, date, stage and **Milestone owner**.
2. Tick **Requires HOD / stakeholder approval** if it needs sign-off.
3. Save.

If approval is required:
- everyone gets an **Approval Requested** notification;
- every **Coordinator** gets an email *"Milestone Approval Required: …"*.

### 7.2 Approving
- A pending milestone shows **Approval · Pending** with **Approve** / **Reject** buttons.
- **Only Coordinators** can approve or reject. Other roles see the buttons, but the server refuses.
- When work is finished, an editor clicks **Complete**, and the milestone moves to *Completed Milestones*.

---

## Stage 8 — Issues and risks

**Issues & risks** tab.

### 8.1 Raising an issue (editors)
Use **Add issue or risk**:

| Field | Values |
|---|---|
| Issue or risk title * | |
| Category | Design, Procurement, Billing, Construction, Approval, Other |
| Stage | Which stage it affects |
| Severity | **High**, Medium, Low |
| Issue owner | |
| Issue Arise Date / Target Closure Date | |
| Description * | Issue, cause, current situation |
| Schedule / Cost / Scope-quality impact | |
| Next action / resolution | |

Click **Add issue**.

### 8.2 Status lifecycle
Open → Under review → Action in progress → Resolved → Closed. Editors change it with the inline **Status** dropdown.

### 8.3 Critical alerts 🚨
- When an issue is created as **High**, everyone gets a **Critical Issue** notification, and every **HOD and Coordinator** gets an email *"🚨 CRITICAL ISSUE: {title} ({project})"*.
- Raising an existing issue to **High** sends the email again.
- High issues also count in the dashboard's **Needs attention** card.

---

## Stage 9 — Stage updates and @mentions

**Updates** tab → *Stage updates*. This is the project's running diary.

### 9.1 Posting an update (editors)
1. **Add stage update**: choose the **stage** and **kind** (Progress, Decision, Risk, General).
2. Write the note. To tag someone, type **@** and start their name (see 9.2).
3. Optionally use **Tag & Email Member** to pick people from a list.
4. Click **Post update**.

The update is always recorded under **your** name. Tagged people get a notification and an email.

### 9.2 @ suggestions
- Type `@` followed by part of a name, surname, email or job title. Spaces are allowed, e.g. `@akash ku`.
- Suggestions are forgiving of small typos (`@aksh` and `@akaash` both find *Akash*). The matching letters are **highlighted**.
- The list (**Encalm Directory (@)**) includes the company directory as well as app users.
- **Only the person you pick gets emailed.** Typing a name that several people share never emails all of them. Instead you see *"Which {name}? Several people share this name."* — click the right person. **Post update** stays disabled until you choose.

---

## Stage 10 — Tagging people and email

You can tag people on stages, milestones and issues (the **Tag Member** button), and on updates.

### 10.1 Who can tag
Coordinators (any project), HODs (any project), and Leads (projects they can edit). Viewers cannot tag.

### 10.2 How to tag
1. Click **Tag Member** to open **Tag & Send Email**.
2. Tick people under **Select Member(s):**, or type `@name` in **Add Message / Comment:**.
3. Check the **Will email:** list. That is exactly who will receive the email. People without an email address show *"no email: dashboard notice only"*.
4. Write your message and click **Tag & Send Mail**.

### 10.3 Whose name the email comes from
- Emails are sent **from your own Encalm mailbox** (Microsoft 365) and appear in your **Sent Items**. Replies come straight back to you.
- **Nobody can send email as anyone else.** The sender is always the signed-in user, decided by the server.
- If your mailbox cannot be used, the email is sent from the system mailbox as *"{Your name} via Encalm Projects"*, with replies going to you.

### 10.4 What the messages mean
- *"Emails to … are on their way, sent from your address."* — sent.
- *"Emails to … are waiting in the Outbox: no email service is connected yet."* — queued. A coordinator should check Email Settings.
- Failed emails are retried automatically up to 5 times over about 8 minutes.

---

## Stage 11 — Site photographs

**Site Photograph** tab → *Site Photographs Gallery*.

- **Latest Verified Progress** shows the newest photo with caption, date captured, uploader and size. Use **View High-Res** for the full image.
- **All Project Photographs (N)** lists every photo.

### Uploading (editors)
1. **Upload Site Photographs**.
2. Drop or **Browse Device / Choose Photos**. Accepted: **JPEG, PNG or WebP**, **up to 20 photos at a time, 10 MB each**. Phone camera photos work.
3. Give each photo a caption, or fill in **Batch Metadata**: stage, category (Progress, Snag / Issue, Milestone, Before / After, Inspection, General) and date captured. Then click **Apply to all photos**.
4. Click **Upload N Site Photographs**.

Photos are stored compressed with thumbnails. Everyone is notified with **Site Photograph Updated**. Editors can **Delete** a photo.

---

## Stage 12 — Commercials, area program and area sheet

### 12.1 Commercial tab
- **Capital position & commercial metrics**:
  - Approved Budget (AOP), Committed / Awarded, Projected Cost, Spent Till Date, Balance Remaining, and Cost Variance (Projected − AOP);
  - bars for awarded vs AOP and spent vs awarded;
  - a **Commercial Overrun Alert** when limits are exceeded.
- Editors: **Edit commercial data** → Approved AOP, Committed Cost, Projected Cost and Spent Till Date (₹ Cr) → **Save**.
- **Budget by phase**:
  - Editors click **Edit phase budgets**, then use **Even Split** or **Split by Weight**, or type amounts directly.
  - Finish with **Save stage budgets**.

### 12.2 Area Program tab
For hotels, or projects with a space program. It covers Key FOH Areas, Floor-wise BUA, Room Configuration by Floor, and MEPF Services & Plant Capacities. Editors use **Edit Program Data**.

### 12.3 Project Area Sheet (sidebar)
The master area register across all facilities.
- Search by facility name, terminal or SL No.
- Filter by section (Lounges & Wellness, Office/Kitchen & Misc, Airport Hotels) and status (Operational / Handed-over, Under Construction, HOLD, Yet to start).
- Export to **CSV**.

---

## Stage 13 — Notifications

Click 🔔 (top bar or sidebar). A red badge shows the unread count.

| Notification | When |
|---|---|
| New Project Created | A project is created |
| Project Allotted | A coordinator allots a project |
| Decision Needed | A stage gets a *Decision required* |
| Approval Requested | A milestone needs approval |
| Critical Issue | A High-severity issue is raised |
| Tagged on … | Someone tagged you |
| Site Photograph Updated | Photos were uploaded |

- **Mark read** clears one item and **Read all** clears everything.
- **Open project >** jumps to the project.
- *"All clear"* means nothing is waiting.

---

## Stage 14 — Reporting and executive updates

### 14.1 Executive Update email
On a project, click **Email Update** → **Send Executive Update**.
1. Under **Executive Recipients (@mention to add)**, type `@name` to add people (1–50).
2. Write the **Executive Commentary / Note**.
3. Click **Send Branded Update Email**.

The email is a branded status summary of the project, sent from your mailbox.

**Who can send:** Coordinators, HODs, and Leads on their own projects.

### 14.2 Project reports (sidebar)
- **Export as CSV** / **Export full portfolio (CSV)** — for Excel.
- **Download Full Backup (JSON)** — a copy of the portfolio as your browser sees it.

### 14.3 Other views
- **Timeline**, **Milestones**, **Issues & risks**, **Update feed**, **Site photographs** and **Budget & AOP** in the sidebar show the same information across *all* projects at once.
- **My projects** (leads) shows only your projects.

---

## Stage 15 — Coordinator administration

### 15.1 Team & Allotment
- **Create Project Lead**: Full Name, Email Address, Initial Password and Role Title → **Create Project Lead Account**. The lead must change the password at first sign-in.
  - Only *Lead* accounts can be created here. Coordinators, HODs and Viewers are created by IT (Stage 16).
- **Active Project Leads**:
  - **Reset password** shows a new temporary password **once**. Give it to the person privately; they must change it when they sign in.
- **Project Allotment & Ownership**: **Allot to {name}** gives a project to a lead.

### 15.2 Email Hub (✉️ in the top bar, or Settings → Communications → **Manage**)
- **Outbox & Delivery Logs**: every email with its status (*sent, outbox, queued, failed*).
  - **Preview** shows the email.
  - **Dispatch** resends an *outbox* or *failed* email.
  - **Refresh** reloads the list.
- **Email Settings**
  - **Microsoft 365: connected / not configured**. The Microsoft 365 keys live only on the server and are never shown in the app.
  - **SMTP (fallback)** — only needed if Microsoft 365 is not connected. **Save SMTP Settings**.
  - **Send me a test email** sends a test to your own address.

### 15.3 Settings (⚙️)
- **Profile** shows your name, email and role.
- **Preferences**: **Compact navigation** keeps the sidebar collapsed.
- **Access** describes your role.
- **Database management & Backup**
  - **Server backups**: when the last backup was made, how many are kept, and the daily schedule. **Back up now** makes one immediately (at most once a minute). **Use it before any big change or update.**
  - **Export Backup** saves a JSON file of the portfolio.
  - **Import Backup** restores a JSON file. Coordinators only, and it *replaces* current data.
  - ⚠️ **Clear all project data** removes everything. It is disabled on the live server for safety. Do not use it.

### 15.4 Audit log
Every important change (sign-ins, edits, deletions, backups, settings) is recorded with who did it and when. There is no screen for it yet; IT can read it for you.

---

## Stage 16 — Server administration (IT / Plesk)

*The server is Plesk on Windows. Open the domain → **PowerShell** (or RDP), then go to the app folder.*

```powershell
cd C:\Inetpub\vhosts\projects.encalmhospitality.com\httpdocs
$node = "C:\Program Files\nodejs\node.exe"
```

### 16.1 Create or change a user
```powershell
$pw = "Temp-" + [guid]::NewGuid().ToString("N").Substring(0,10)
& $node server\dist\create-user.js "Full Name" "name@encalm.com" $pw coordinator "Project Coordinator"
$pw
```
- The role is one of `coordinator`, `lead`, `hod` or `viewer`. Anything else is refused.
- Running it again for an existing email updates that user's name, role and password.
- Give the person the temporary password privately; they must change it at first sign-in. **Never paste passwords in chat or email threads.**

### 16.2 Backups
- **Automatic:** every night at **02:15** server time. The app saves `encalm-data\backups\encalm-<date>.db.gz` and mirrors the photos to `backups\uploads`.
  - Backups are kept for 30 days, and the newest 7 are always kept.
  - If the server was off at 02:15, a catch-up backup runs a few minutes after start.
- **Off-site:** Plesk **Backup Manager** → remote storage **OneDrive**. Schedule it daily and include the `encalm-data` folder.
- **Manual:** **Back up now** in Settings, as a coordinator.

### 16.3 Restore a backup
1. Plesk → Node.js → **Disable Node.js**.
2. Run the restore helper:
   ```powershell
   & $node server\dist\restore-backup.js ..\encalm-data\backups\encalm-YYYYMMDDTHHMMSSZ.db.gz
   ```
   The current database is kept as `*.before-restore-<time>`.
3. Click **Enable Node.js**, then **Restart App**.
4. Open `/api/system/ready`. It should show `{"status":"ready"}`.

To undo, rename the `*.before-restore-*` files back.

### 16.4 Deploying an update
1. Click **Back up now** first.
2. Plesk → **Git** → **Pull now** / **Pull Updates** (branch `plesk-release`). The app restarts by itself.
3. If packages changed: Node.js → **NPM install**, then **Restart App**.
4. Check `https://projects.encalmhospitality.com/api/client-config`. The `release` value should match the latest commit.

### 16.5 Where the data lives
`C:\Inetpub\vhosts\projects.encalmhospitality.com\encalm-data\`
- `encalm.db` — the database. Never delete or edit it by hand.
- `uploads\` — photos.
- `backups\` — nightly backups.

---

## Troubleshooting and FAQ

| Problem | What to do |
|---|---|
| "Invalid email or password" and you're sure it's right | You may be paused after 5 failed attempts. Wait 15 minutes, or ask a coordinator to **Reset password**. |
| Can't see **Edit project** | The project is allotted to another lead, or you are an HOD/Viewer. Ask a coordinator to allot it. |
| **Approve** says it isn't allowed | Only Coordinators approve milestones. |
| Tagged email "waiting in the Outbox" | No email service is connected. A coordinator should open Email Hub → Email Settings → **Send me a test email**. |
| "Which Akash?" appears | Several people share the name. Click the right person; only they are emailed. |
| Photo upload refused | Only JPEG/PNG/WebP, at most 10 MB each and 20 at a time. |
| Changes from a colleague not showing | Wait up to 15 seconds, or reload the page. |
| Site shows an error after an update | IT: Node.js → **Restart App**, check `/api/system/ready`, then see PRODUCTION.md §15 troubleshooting. |
| Forgot password | Ask a coordinator (leads) or IT (other roles). |

---

## Known limitations

These are known gaps in the current version. Avoid relying on them.

- **Settings → Update reminders** is a saved preference only. No reminders are sent yet.
- **Settings → Access** wrongly describes Coordinators as "read-only". Coordinators have full access.
- **Import Backup** and **Clear all project data** are shown to every role and may show a success message even when the server refused. The data is unchanged and comes back on the next refresh. Only Coordinators can really import, and clearing is disabled on the live server.
- **Approve / Reject** are visible to everyone but only work for Coordinators.
- Milestones are not marked *late* automatically, and there are no automatic overdue-milestone notifications. The dashboard's **Next up** does label overdue dates.
- There is no self-service "change my password" outside first sign-in, and no in-app audit-log screen.

---

## Quick reference cards

**Coordinator**
- Create and edit any project.
- Allot projects to leads, and create and reset leads.
- Approve milestones.
- Run the Email Hub.
- Use **Back up now** before big changes.

**Project Lead**
- Create projects; edit your own projects.
- Keep stages current: progress, next action, decision required.
- Raise issues; use High only for real critical issues, because it emails HODs.
- Post updates with @tags and upload site photos.

**HOD**
- Watch the dashboard, **Needs attention** and **Management attention**.
- Act on **Decision Needed** and **Critical Issue** alerts.
- Tag people or send an **Email Update** to push for action.

**Viewer**
- Browse the dashboard, projects, photos and reports.
- Nothing can be changed from a viewer account.
