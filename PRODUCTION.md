# Encalm Project Dashboard: Production Runbook

The one place for running the dashboard on a VPS (written for a GoDaddy Ubuntu VPS; any Ubuntu 22.04/24.04 server works).

1. [How it runs](#1-how-it-runs)
2. [First-time VPS setup](#2-first-time-vps-setup)
3. [Moving an existing install to this layout](#3-moving-an-existing-install-to-this-layout)
4. [GitHub: CI and deploy](#4-github-ci-and-deploy)
5. [Deploying](#5-deploying)
6. [Rolling back](#6-rolling-back)
7. [Staging](#7-staging)
8. [SSL certificates](#8-ssl-certificates)
9. [Backups and restore](#9-backups-and-restore)
10. [Monitoring and logs](#10-monitoring-and-logs)
11. [Rotating secrets](#11-rotating-secrets)
12. [Users and passwords](#12-users-and-passwords)
13. [Incident checklist](#13-incident-checklist)
14. [Docker (alternative)](#14-docker-alternative)
15. [Plesk on Windows (iisnode)](#15-plesk-on-windows-iisnode)
16. [Reference](#16-reference)

---

## 1. How it runs

One Node.js process per environment serves both the API and the built React app. Nginx in front terminates HTTPS, serves the hashed `/assets` files from disk and proxies everything else to the app on `127.0.0.1`. SQLite (WAL mode) holds all data; photos are files next to it.

```
Internet ─▶ Nginx :443 (TLS, HTTP/2, gzip, headers, /assets from disk)
               └─▶ PM2 "encalm-production" ─▶ node server/dist/index.js on 127.0.0.1:5000
                                                  └─▶ /var/lib/encalm/production/{encalm.db, uploads/}
```

Always **one** process per environment: SQLite, the email queue worker and the login rate limiter assume it.

| What | Where |
|---|---|
| Code releases | `/opt/encalm/<env>/releases/<timestamp>-<sha>/` (newest 3 kept) |
| Live release | `/opt/encalm/<env>/current` → a release (symlink) |
| Git clone used by deploys | `/opt/encalm/repo` |
| PM2 process file | `/opt/encalm/ecosystem.config.cjs` (from `deploy/ecosystem.config.cjs`) |
| Secrets and settings | `/etc/encalm/<env>.env` (root:encalm, 640) |
| Database and photos | `/var/lib/encalm/<env>/` |
| Backups | `/var/backups/encalm/<env>/` |
| App logs | `/var/log/encalm/<env>.out.log`, `<env>.err.log` (JSON lines), `backup-<env>.log` |
| Nginx site | `/etc/nginx/sites-available/encalm-<env>.conf` (from `deploy/nginx.conf`) |

`<env>` is `production` (port 5000) or `staging` (port 5001). Everything runs as the unprivileged user `encalm`.

---

## 2. First-time VPS setup

### 2.1 Before you start

- A VPS running **Ubuntu 24.04 LTS** (22.04 also works), with root SSH access. 1 GB RAM minimum, 2 GB recommended; 20 GB disk.
- Its public IPv4 address (GoDaddy: **My Products → Servers → Manage → Server details**).
- The domain at GoDaddy and the hostname you want, e.g. `projects.encalm.com`.
- An email address for Let's Encrypt expiry notices.

### 2.2 Log in with an SSH key

From your own computer (once):

```bash
ssh-keygen -t ed25519 -C "you@encalm.com"          # skip if you already have a key
ssh-copy-id root@<VPS-IP>                           # or the sudo user GoDaddy created
ssh root@<VPS-IP>                                   # must work without a password prompt
```

The setup script turns password login **off**, but only if a key login already works, so you cannot lock yourself out.

### 2.3 DNS on GoDaddy

1. Sign in at godaddy.com → **My Products** → next to the domain, **DNS** (Manage DNS).
2. **Add New Record**: Type **A**, Name `projects` (the part before the domain; `@` for the bare domain), Value = the VPS IPv4, TTL **1 Hour**. Save.
3. If the VPS has an IPv6 address, add an **AAAA** record with the same name. Otherwise do not add one.
4. Staging: add another A record, e.g. `staging.projects`, pointing at the same IP.
5. Wait until it resolves (usually minutes): `dig +short projects.encalm.com` must print the VPS IP.

Let's Encrypt cannot issue the certificate until this resolves.

### 2.4 Run the setup script

On the VPS, as root:

```bash
git clone https://github.com/digitalintern123/Project-Dashboard.git /root/encalm-setup
cd /root/encalm-setup

# 1. See exactly what it will do. Changes nothing.
deploy/setup-vps.sh --dry-run --domain projects.encalm.com --email ops@encalm.com \
  --repo git@github.com:digitalintern123/Project-Dashboard.git

# 2. Do it.
deploy/setup-vps.sh --domain projects.encalm.com --email ops@encalm.com \
  --repo git@github.com:digitalintern123/Project-Dashboard.git
```

(If the repository is private, `git clone` it here with a personal access token or copy the folder over with `scp`; the script itself sets up a read-only deploy key for later deploys.)

What it does, in order (every step checks first, so re-running is safe):

1. **Packages:** nginx, certbot, sqlite3, ufw, fail2ban, unattended-upgrades, build tools, Node.js 22 LTS (NodeSource), PM2.
2. **Automatic security updates** (`unattended-upgrades`).
3. **User and folders:** system user `encalm`; the folders in the table above with tight permissions.
4. **SSH:** a GitHub deploy key for `encalm` (`/opt/encalm/.ssh/github_deploy`); `--ci-pubkey` adds the GitHub Actions key; key-only login (`/etc/ssh/sshd_config.d/99-encalm-hardening.conf`) if a key login exists.
5. **Firewall:** ufw denies everything incoming except 22, 80, 443. **fail2ban** bans IPs after repeated SSH failures or Nginx rate-limit hits.
6. **Env file** `/etc/encalm/production.env` with a fresh `JWT_SECRET` and `SETTINGS_ENCRYPTION_KEY` (only if the file does not exist yet).
7. **Nginx + certificate:** a temporary HTTP site, `certbot certonly --webroot`, then the full HTTPS site from `deploy/nginx.conf`, plus a renewal hook that reloads Nginx.
8. **Log rotation** (`/etc/logrotate.d/encalm`), **PM2 on boot** (systemd), **nightly backup** at 02:15 (crontab of `encalm`).
9. **First deploy** of `main`.

**When it stops at the clone step**, it prints a public key. Add it at GitHub → repository → **Settings → Deploy keys → Add deploy key** (read-only), then run the same command again.

Dry run on a fresh server, for reference (abridged only where marked):

```text
DRY RUN: nothing will be changed.

==> System packages
    + apt-get update -q
    + apt-get install -y -q ca-certificates curl git gnupg nginx certbot sqlite3 ufw fail2ban unattended-upgrades logrotate build-essential python3 rsync
    + curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    + apt-get install -y -q nodejs
    + npm install -g pm2@5

==> Unattended security upgrades
    + write /etc/apt/apt.conf.d/20auto-upgrades (0644 root:root)
    + systemctl enable --now unattended-upgrades

==> App user 'encalm' and directories
    + useradd --system --create-home --home-dir /opt/encalm --shell /bin/bash encalm
    + install -d -m 0755 -o encalm -g encalm /opt/encalm /opt/encalm/production /opt/encalm/production/releases
    + install -d -m 0750 -o encalm -g encalm /var/lib/encalm /var/lib/encalm/production /var/backups/encalm /var/backups/encalm/production
    + install -d -m 0750 -o encalm -g adm /var/log/encalm
    + install -d -m 0750 -o root -g encalm /etc/encalm
    + install -d -m 0755 /var/www/certbot
    + install -m 0644 -o encalm -g encalm /root/encalm-setup/deploy/ecosystem.config.cjs /opt/encalm/ecosystem.config.cjs

==> SSH keys
    + install -d -m 0700 -o encalm -g encalm /opt/encalm/.ssh
    + (as encalm) ssh-keygen -t ed25519 -N '' -C 'encalm-vps-deploy' -f ~/.ssh/github_deploy -q
    + write /opt/encalm/.ssh/config (0600 encalm:encalm)
    + write /etc/ssh/sshd_config.d/99-encalm-hardening.conf (0644 root:root)
    + sshd -t
    + systemctl reload ssh

==> Firewall (22, 80, 443 only) and fail2ban
    + ufw default deny incoming
    + ufw default allow outgoing
    + ufw allow 22/tcp
    + ufw allow 80/tcp
    + ufw allow 443/tcp
    + ufw --force enable
    + write /etc/fail2ban/jail.d/encalm.local (0644 root:root)
    + systemctl enable --now fail2ban
    + systemctl restart fail2ban

==> Environment file /etc/encalm/production.env
    + write /etc/encalm/production.env (0640 root:encalm)
    generated JWT_SECRET and SETTINGS_ENCRYPTION_KEY. Back this file up somewhere safe.

==> Nginx site for projects.encalm.com
    + rm -f /etc/nginx/sites-enabled/default
    + write /etc/nginx/sites-available/encalm-production.conf (0644 root:root)
    + ln -sfn /etc/nginx/sites-available/encalm-production.conf /etc/nginx/sites-enabled/encalm-production.conf
    + nginx -t
    + systemctl reload nginx
    + certbot certonly --webroot -w /var/www/certbot -d projects.encalm.com --email ops@encalm.com --agree-tos --no-eff-email --non-interactive
    + write /etc/nginx/sites-available/encalm-production.conf (0644 root:root)
    + ln -sfn /etc/nginx/sites-available/encalm-production.conf /etc/nginx/sites-enabled/encalm-production.conf
    + nginx -t
    + systemctl reload nginx
    + write /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh (0755 root:root)

==> Log rotation, PM2 startup, nightly backup
    + install -m 0644 /root/encalm-setup/deploy/logrotate.conf /etc/logrotate.d/encalm
    + env PATH=… pm2 startup systemd -u encalm --hp /opt/encalm
    + crontab (encalm): 15 2 * * * cd /opt/encalm/production/current && DATA_DIR=/var/lib/encalm/production BACKUP_DIR=/var/backups/encalm/production RCLONE_REMOTE=$(sed -n 's/^RCLONE_REMOTE=//p' /etc/encalm/production.env) ./scripts/backup.sh >> /var/log/encalm/backup-production.log 2>&1

==> Repository and first deploy
    + (as encalm) GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git clone --quiet 'git@github.com:digitalintern123/Project-Dashboard.git' '/opt/encalm/repo'
    + (as encalm) /opt/encalm/repo/deploy/deploy.sh production main

==> Done
    Site:         https://projects.encalm.com
    Env file:     /etc/encalm/production.env (secrets; back it up)
    Data:         /var/lib/encalm/production    Backups: /var/backups/encalm/production
    Logs:         pm2 logs encalm-production   /var/log/encalm/
    First user:   sudo -u encalm bash -c 'cd /opt/encalm/production/current && DOTENV_CONFIG_PATH=/etc/encalm/production.env npm run create-user -- "Full Name" you@company.com "Temp-pass-123" coordinator'
```

Options: `--env staging` (see [Staging](#7-staging)), `--skip-certbot` (DNS not ready yet; re-run later), `--skip-ssh-hardening`, `--skip-deploy`, `--ci-pubkey "ssh-ed25519 …"`.

### 2.5 After setup

1. **Back up `/etc/encalm/production.env`** to your password manager. Without `SETTINGS_ENCRYPTION_KEY` the stored email password cannot be decrypted; without the file you cannot rebuild the server as it was.
2. **Create the first coordinator** (the command printed at the end). Use a temporary password; they must change it at first sign-in. Prefix the command with a space so it stays out of shell history.
3. Open `https://projects.encalm.com`, sign in, change the password, then configure email under **Settings → Email** and send a test email.
4. Set up [monitoring](#10-monitoring-and-logs) and, if wanted, off-site backups (`RCLONE_REMOTE`, [section 9](#9-backups-and-restore)).

---

## 3. Moving an existing install to this layout

For a server that already runs the dashboard the old way (a git checkout with `server/data/` inside it, PM2 app `encalm-dashboard`, `.env` in the checkout). Plan 15 minutes of downtime.

```bash
# As root. OLD = the old checkout, e.g. /opt/encalm
OLD=/opt/encalm

# 1. Stop the old app and take a consistent copy of everything.
pm2 stop encalm-dashboard
sqlite3 $OLD/server/data/encalm.db ".backup /root/encalm-before-move.db"
tar -czf /root/encalm-uploads-before-move.tgz -C $OLD/server/data uploads
cp $OLD/.env /root/encalm-old.env

# 2. Move the old checkout out of the way (setup uses /opt/encalm).
mv $OLD /opt/encalm-old

# 3. Run setup without the first deploy.
deploy/setup-vps.sh --domain projects.encalm.com --email ops@encalm.com \
  --repo git@github.com:digitalintern123/Project-Dashboard.git --skip-deploy

# 4. Bring the data over.
rsync -a /opt/encalm-old/server/data/ /var/lib/encalm/production/
chown -R encalm:encalm /var/lib/encalm/production
```

5. **Secrets:** compare `/root/encalm-old.env` with `/etc/encalm/production.env`.
   - If the old file had a `SETTINGS_ENCRYPTION_KEY`, copy that value into the new file (otherwise the saved email password cannot be decrypted; you would re-enter it in Settings).
   - Copy any `SMTP_*` / `MS_GRAPH_*` values you rely on.
   - Keep the **new** `JWT_SECRET` (everyone signs in again once). Never reuse `encalm-secret-jwt-key-2026` or any value that has been in git.
6. Remove the old PM2 entry and any old Nginx site:
   ```bash
   pm2 delete encalm-dashboard && pm2 save          # as the user that ran it (often root)
   ls /etc/nginx/sites-enabled/                       # remove anything except encalm-production.conf
   nginx -t && systemctl reload nginx
   ```
7. Deploy and check: `sudo -u encalm /opt/encalm/repo/deploy/deploy.sh production main`, then sign in.
8. After a week without problems: `rm -rf /opt/encalm-old` (the backups in `/root` and `/var/backups/encalm` remain).

---

## 4. GitHub: CI and deploy

### CI (`.github/workflows/ci.yml`)

Runs on every push and pull request, three jobs in parallel:

| Job | Checks |
|---|---|
| Lint, types, tests, build, audit | `npm ci`, ESLint (zero warnings), Prettier, `tsc`, unit + API tests with coverage (≥ 80 % lines), web tests, `npm run build`, `npm audit --audit-level=high`, shellcheck on the scripts, backup/restore round trip |
| Secret scan | gitleaks over the full git history (`.gitleaks.toml`) |
| Playwright end-to-end | Builds the app and runs the role-based browser tests |

Recommended: GitHub → **Settings → Branches → Add rule** for `main`: require pull requests and the three CI checks to pass.

### Deploy (`.github/workflows/deploy.yml`)

Runs when started by hand (**Actions → Deploy → Run workflow**, choose environment and branch/tag) or when a tag `v*` is pushed (deploys that tag to production). It SSHes to the VPS as `encalm` and runs `deploy/deploy.sh` from the commit being deployed.

One-time setup:

1. **A key for GitHub Actions** (on your computer):
   ```bash
   ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy' -f encalm_ci
   ```
   Authorise it on the VPS: `deploy/setup-vps.sh … --ci-pubkey "$(cat encalm_ci.pub)"`, or append `encalm_ci.pub` to `/opt/encalm/.ssh/authorized_keys` (owner `encalm`, mode 600).
2. **The VPS host key** (on a machine you trust, e.g. right after setup): `ssh-keyscan -t ed25519 projects.encalm.com`.
3. GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**:

   | Secret | Value |
   |---|---|
   | `VPS_HOST` | `projects.encalm.com` (or the IP) |
   | `VPS_USER` | `encalm` |
   | `VPS_SSH_KEY` | contents of `encalm_ci` (the private key, including the BEGIN/END lines) |
   | `VPS_HOST_KEY` | the `ssh-keyscan` line from step 2 (recommended; without it the first connection is trusted blindly) |
   | `VPS_PORT` | only if SSH is not on 22 |

4. GitHub → **Settings → Environments**: create `production` and `staging`. On `production`, add **Required reviewers** so every production deploy needs an approval click.
5. Delete `encalm_ci` from your computer once it is stored in GitHub.

---

## 5. Deploying

**Normal path:** merge to `main` (CI green) → **Actions → Deploy → Run workflow** → environment `staging`, ref `main` → check staging → run again with `production`. Or tag a release: `git tag v1.4.0 && git push origin v1.4.0` (deploys to production).

**By hand on the VPS:**

```bash
sudo -u encalm /opt/encalm/repo/deploy/deploy.sh production main        # or a tag / commit
sudo -u encalm DRY_RUN=1 /opt/encalm/repo/deploy/deploy.sh production main   # show the steps only
```

What `deploy/deploy.sh` does:

1. Fetches the ref into `/opt/encalm/repo` and re-runs itself from that commit (script and code always match).
2. Unpacks the commit as a new release; `npm ci`, `npm run build`, removes dev dependencies.
3. Backs up the database (`scripts/backup.sh`).
4. Runs migrations (`npm run migrate`). If a migration fails, it stops here: the old release keeps serving.
5. Points `current` at the new release and reloads PM2 (a 2-3 second restart; one process cannot hand over without a gap).
6. **Health gate:** `/api/system/ready` must answer and `/api/client-config` must report the new release id within 90 seconds.
7. **On failure:** switches back to the previous release, restores the pre-deploy database if the schema changed (the failed release's database is moved aside, never deleted), reloads, and exits with an error. The failed release is marked and never picked by a rollback.

Dry run, for reference:

```text
[hh:mm:ss] DRY RUN: commands are printed, nothing is changed
[hh:mm:ss] Fetching main
  + git -C /opt/encalm/repo fetch --prune --tags origin
[hh:mm:ss] Re-running deploy.sh from <sha>
[hh:mm:ss] Deploying <sha> as <release-id> to production (previous: /opt/encalm/production/releases/<release-id>)
  + mkdir -p /opt/encalm/production/releases/<release-id>
  + git -C /opt/encalm/repo archive <sha> | tar -x -C /opt/encalm/production/releases/<release-id>
[hh:mm:ss] Installing and building
  + npm ci --no-audit --no-fund
  + npm run build
  + npm prune --omit=dev --no-audit --no-fund
[hh:mm:ss] Backing up /var/lib/encalm/production/encalm.db
  + env DATA_DIR=/var/lib/encalm/production BACKUP_DIR=/var/backups/encalm/production /opt/encalm/production/releases/<release-id>/scripts/backup.sh
[hh:mm:ss] Running migrations
  + env DOTENV_CONFIG_PATH=/etc/encalm/production.env NODE_ENV=production node /opt/encalm/production/releases/<release-id>/server/dist/migrate.js
[hh:mm:ss] Switching production to <release-id>
  + install -m 0644 /opt/encalm/production/releases/<release-id>/deploy/ecosystem.config.cjs /opt/encalm/ecosystem.config.cjs
  + ln -sfn /opt/encalm/production/releases/<release-id> /opt/encalm/production/current.tmp
  + mv -T /opt/encalm/production/current.tmp /opt/encalm/production/current
  + pm2 startOrReload /opt/encalm/ecosystem.config.cjs --only encalm-production --update-env
  + poll http://127.0.0.1:5000/api/system/ready and /api/client-config (release <release-id>)
  + pm2 save
[hh:mm:ss] Healthy. production is on <release-id>
```

Settings changed in `/etc/encalm/production.env` take effect on the next deploy, or immediately with `sudo -u encalm pm2 reload encalm-production`.

---

## 6. Rolling back

**Automatic:** a deploy that fails its health check rolls itself back (section 5).

**By hand**, for a problem noticed after a deploy succeeded:

```bash
sudo -u encalm /opt/encalm/production/current/deploy/rollback.sh production
#   lists releases (* live, x failed) and switches to the one deployed before the live one

sudo -u encalm /opt/encalm/production/current/deploy/rollback.sh production 20261012162451-ee9bdd8c
#   switches to a specific release

sudo -u encalm /opt/encalm/production/current/deploy/rollback.sh production <release-id> --restore-db <backup-stamp>
#   also restores a database backup: only when the bad release changed the schema.
#   Changes made since that backup are moved to /var/lib/encalm/production/pre-restore-<time>/, not deleted.
```

Backup stamps: `ls /var/backups/encalm/production/` (the pre-deploy backup is the one taken just before the bad deploy).

---

## 7. Staging

Staging runs on the same VPS as a second app (`encalm-staging`, port 5001) with its **own** data, secrets and hostname.

```bash
deploy/setup-vps.sh --env staging --domain staging.projects.encalm.com --email ops@encalm.com \
  --repo git@github.com:digitalintern123/Project-Dashboard.git
```

Then edit `/etc/encalm/staging.env` (template: `deploy/env/staging.env.example`): leave SMTP empty so staging never emails real people (mail stays in the in-app outbox). Deploy with the Deploy workflow, environment `staging`.

---

## 8. SSL certificates

- Issued by Let's Encrypt during setup; certbot's systemd timer renews them automatically and the renewal hook reloads Nginx.
- Check renewal works: `sudo certbot renew --dry-run`. Check expiry: `sudo certbot certificates`.
- If issuance fails: `dig +short <domain>` must return this server's IP, and port 80 must be reachable (`sudo ufw status`).
- HSTS is on (one year). Do not serve the site over plain HTTP again once browsers have seen it.

---

## 9. Backups and restore

Everything lives in `DATA_DIR` (`/var/lib/encalm/<env>`): `encalm.db` (SQLite, WAL mode) and `uploads/` (photos). Do **not** `cp` or `tar` a live `encalm.db`; with WAL that can capture a torn copy. Use the scripts.

**Nightly** at 02:15 (installed by setup), `scripts/backup.sh`: online-safe SQLite backup with an integrity check, gzip, a tarball of `uploads/`, SHA-256 checksums, 30-day local retention, optional copy off the server. Every deploy also takes a backup first.

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./server/data` | Where `encalm.db` and `uploads/` live |
| `BACKUP_DIR` | `/var/backups/encalm` | Local backup folder (`/var/backups/encalm/<env>` on the VPS) |
| `RETENTION_DAYS` | `30` | Local copies older than this are deleted |
| `RCLONE_REMOTE` | (empty) | e.g. `b2:encalm-backups/production`; set in `/etc/encalm/<env>.env` |
| `RCLONE_RETENTION_DAYS` | `RETENTION_DAYS` | Remote copies older than this are deleted |

**Off-site copies (strongly recommended):** `sudo apt install rclone`, then as `encalm`: `sudo -u encalm rclone config` (e.g. Backblaze B2 or any S3), and set `RCLONE_REMOTE` in the env file. A copy only on the same VPS does not survive losing the VPS.

**Restore:**

```bash
sudo -u encalm pm2 stop encalm-production
cd /opt/encalm/production/current
sudo -u encalm env DATA_DIR=/var/lib/encalm/production BACKUP_DIR=/var/backups/encalm/production ./scripts/restore.sh          # list
sudo -u encalm env DATA_DIR=/var/lib/encalm/production BACKUP_DIR=/var/backups/encalm/production ./scripts/restore.sh latest   # or a stamp
sudo -u encalm pm2 start encalm-production
```

The restore verifies checksums and integrity and moves the current database and uploads aside to `DATA_DIR/pre-restore-<time>/` first; nothing is deleted. If the server is lost: build a new one (section 2), copy the backup files back (`rclone copy <remote> /var/backups/encalm/production --include 'encalm-<STAMP>*'`), restore, then put the saved env file in place.

**Test the round trip** at any time (throwaway directory): `npm run test:backup`. CI runs it on every push.

**Optional:** continuous replication with Litestream (`deploy/litestream.yml`) for near-zero data loss between nightly backups.

`portfolio-database.json` in the data folder is a convenience export of project data only (no users, sessions, audit log or settings). It is not a backup.

---

## 10. Monitoring and logs

### Uptime: UptimeRobot (free)

1. Sign up at uptimerobot.com → **Add New Monitor**.
2. Type **HTTP(s) - Keyword**, URL `https://projects.encalm.com/api/system/ready`, keyword `ready` (alert when it does **not** exist), interval 5 minutes.
3. Alert contacts: email (and SMS/Slack if wanted). Add a second monitor for staging if you use it.
4. Optional: a **status page** for the team.

`/api/system/ready` is public, cheap, checks the database, and is not written to the request log. `/api/system/health` (coordinator sign-in required) adds row counts, memory and uptime.

### Errors: Sentry (optional)

Create a Node.js project (and, if you want browser errors separately, a React project) at sentry.io, then in `/etc/encalm/production.env`:

```
SENTRY_DSN=https://…@o….ingest.sentry.io/…
SENTRY_CLIENT_DSN=          # optional: the React project's DSN
```

Reload (`sudo -u encalm pm2 reload encalm-production`). Server errors (500s, crashes) and browser errors are reported with the release id; cookies, auth headers and request bodies are never sent. With no DSN, Sentry is completely off and the browser never downloads it.

### Logs

App logs are JSON lines (pino), one per request plus events, each with a request id (`X-Request-Id`, also sent to the browser and set by Nginx). Passwords, tokens, cookies and secrets are redacted.

```bash
sudo -u encalm pm2 logs encalm-production                       # live tail
sudo -u encalm pm2 status
jq -c 'select(.level >= 50)' /var/log/encalm/production.out.log | tail     # errors
grep '"id":"<request-id>"' /var/log/encalm/production.out.log | jq .      # one request
sudo tail -f /var/log/nginx/encalm-production.error.log
```

`LOG_LEVEL=debug` in the env file gives more detail (reload to apply). Logs rotate daily, 30 days kept, compressed.

---

## 11. Rotating secrets

All in `/etc/encalm/<env>.env` (`sudo nano /etc/encalm/production.env`), then `sudo -u encalm pm2 reload encalm-production`.

| Secret | How | Effect |
|---|---|---|
| `JWT_SECRET` | `openssl rand -base64 48` | Everyone is signed out and signs in again. Rotate after any suspected leak, and **now** on any server that ever ran with the old built-in default. |
| `SETTINGS_ENCRYPTION_KEY` | `openssl rand -base64 32` | Stored email secrets can no longer be decrypted: before rotating, have the SMTP password / Graph client secret at hand; after, re-enter them under **Settings → Email**. |
| SMTP password / Graph client secret | Change at the provider, then **Settings → Email** | Takes effect at once (stored encrypted). |
| GitHub Actions deploy key | New key pair (section 4), replace in `authorized_keys` and the `VPS_SSH_KEY` secret | Old key stops working once removed from `authorized_keys`. |
| VPS deploy key (GitHub read access) | `sudo -u encalm ssh-keygen -t ed25519 -f ~/.ssh/github_deploy` (overwrite), update GitHub → Deploy keys | |
| Sentry DSN | Revoke in Sentry → Client Keys, set the new one | |

A user's password: a coordinator resets it (section 12) and the user chooses a new one at their next sign-in.

---

## 12. Users and passwords

- **Create a user** (also the very first coordinator): leading space keeps it out of shell history.
  ```bash
   sudo -u encalm bash -c 'cd /opt/encalm/production/current && DOTENV_CONFIG_PATH=/etc/encalm/production.env npm run create-user -- "Amit Sharma" amit@encalm.com "Temp-pass-2026" lead "Senior Project Lead"'
  ```
  Roles: `coordinator` (full edit), `lead` (edits own and unassigned projects), `hod` (read-only, approvals). Running it again for an existing email updates name, role and password.
- Coordinators can also add leads in the app (**Team**) and reset a lead's password there; the app shows the temporary password once. For other roles, use `create-user` as above.
- Every new or reset password must be changed at first sign-in, and changing it signs out the user's other sessions. Passwords: at least 10 characters with letters and numbers. (There is no self-service "change my password" screen outside that first sign-in yet; a coordinator reset forces one.)
- Five wrong passwords lock an account for 15 minutes.
- On first start against an empty database the server creates the standard accounts and prints their temporary passwords **once** to the console (`pm2 logs`), not to the JSON log.

---

## 13. Incident checklist

1. **Is it down?** `curl -s https://projects.encalm.com/api/system/ready` · `sudo -u encalm pm2 status` · `systemctl status nginx`.
2. **What changed?** Last deploy: `readlink /opt/encalm/production/current`, Actions → Deploy history. If it started after a deploy: **roll back first, investigate second** (section 6).
3. **Errors:** Sentry; `jq -c 'select(.level >= 50)' /var/log/encalm/production.out.log | tail -50`; `sudo -u encalm pm2 logs encalm-production --lines 200`.
4. **Disk/memory:** `df -h /var /opt` (backups and releases live there) · `free -m`. PM2 restarts the app if it exceeds 512 MB.
5. **Certificate expired?** `sudo certbot certificates`; `sudo certbot renew`.
6. **Database trouble?** `sqlite3 /var/lib/encalm/production/encalm.db 'PRAGMA integrity_check'`; restore from backup (section 9) if needed.
7. **Suspected compromise:** take the site offline (`sudo -u encalm pm2 stop encalm-production`), rotate **all** secrets (section 11) including deploy keys, review `/var/log/auth.log`, the app's audit log (open `https://<domain>/api/system/audit?limit=200` while signed in as a coordinator; JSON, newest first) and Nginx logs, restore from a backup taken before the incident if data was altered, then redeploy.
8. **Afterwards:** write down what happened, how it was found and fixed, and what will prevent it.

---

## 14. Docker (alternative)

`docker compose up -d --build` runs the same app with the data in a named volume. `docker-compose.yml` requires `JWT_SECRET` and `SETTINGS_ENCRYPTION_KEY` in `.env`. Put Nginx (with `deploy/nginx.conf`, port mapped to the container) in front, and run `scripts/backup.sh` against the volume's path. The release/rollback scripts above are for the PM2 setup; with Docker, roll back by checking out the previous tag and running `docker compose up -d --build` again, restoring a backup if the schema changed.

---

## 15. Plesk on Windows (iisnode)

For a Plesk server on Windows, where IIS runs Node.js through iisnode, instead of the Linux VPS setup above. The `deploy/` scripts, the GitHub Deploy workflow and `scripts/backup.sh` are for Linux and do not apply here; Plesk's own Git, Node.js and backup tools take their place.

**Nothing is built on the server.** Windows hosting accounts cannot run the build (esbuild stops with "Cannot read directory …: Access is denied" because the site user may not list `C:\inetpub\vhosts`), and the server has no Python or C++ tools. Instead, every time CI passes on `main`, the **Plesk release** workflow (`.github/workflows/plesk-release.yml`) builds the app on GitHub, checks that it starts with production dependencies only, and commits the ready-to-run files to the branch **`plesk-release`**: `dist/`, `server/dist/`, `package.json`, `package-lock.json`, `.npmrc`, `server.cjs`, `iisnode.yml`. Plesk pulls that branch and only installs the runtime packages.

How it runs: iisnode starts `server.cjs` and passes a named pipe (such as `\\.\pipe\…`) in `PORT` instead of a port number; the app listens on that pipe (`server/src/listen.ts`). `iisnode.yml` sets iisnode up: one process, client IPs forwarded, no stack traces shown to visitors, logs in `iisnode/`.

### 15.1 Code

1. GitHub → repository → **Actions → Plesk release**: it runs by itself after each green CI on `main`; the first time, click **Run workflow** to create the `plesk-release` branch.
2. Plesk → the domain → **Git**: repository `https://github.com/digitalintern123/Project-Dashboard`, branch **`plesk-release`** (not `main`), deployed to the folder that will contain `package.json` (for example `httpdocs`).
3. When switching an existing site from `main` to `plesk-release`, first empty that folder (it holds source files and a half-installed `node_modules` from earlier attempts); the data folder (15.2) is elsewhere and is not touched.

If the folder is `httpdocs`, the Document Root **must** be `httpdocs\dist` (15.3): otherwise IIS would serve the server code and the `iisnode` logs to anyone.

Plesk does not pull new commits by itself: after a release, click **Pull Updates** (and **Deploy Now** if the deployment mode is *Manual*), or add Plesk's **Webhook URL** to GitHub → repository → **Settings → Webhooks** so new releases are pulled automatically.

### 15.2 Data folder

Create `C:\encalm-projects-data` (outside the web root). Right-click → **Properties → Security → Edit → Add** the domain's system user (Plesk → the domain → **Hosting Settings**, e.g. `encalm` or `IWPD_…`) and give it **Modify**. SQLite writes the database, its `-wal`/`-shm` files and the `uploads` folder there.

### 15.3 Node.js settings

Plesk → the domain → **Node.js**:

| Field | Value |
|---|---|
| Node.js Version | 22.x (e.g. 22.23.2) |
| Package Manager | npm |
| Document Root | the Application Root + `/dist`, e.g. `/httpdocs/dist` |
| Application Mode | production |
| Application Root | the folder containing `package.json`, e.g. `/httpdocs` |
| Application Startup File | `server.cjs` |

### 15.4 Custom environment variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | a long random string (48 bytes; see the commands below the table) |
| `SETTINGS_ENCRYPTION_KEY` | **required**: 32 random bytes (commands below). Without it the server refuses to start (500). |
| `APP_BASE_URL` | `https://projects.encalmhospitality.com` (links in emails; iisnode does not tell the app it is on HTTPS) |
| `DATA_DIR` | `C:\encalm-projects-data` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | your mail server (or configure it later under **Settings → Email** in the app) |

Generating the two secrets, either with `openssl` (Git Bash, WSL, Linux, macOS):

```bash
openssl rand -base64 48    # JWT_SECRET
openssl rand -base64 32    # SETTINGS_ENCRYPTION_KEY
```

or in PowerShell on the server (cryptographically secure; change 48 to 32 for the key):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

- Do **not** set `PORT`, `API_PORT` or `HOST`: iisnode supplies the pipe.
- `CORS_ORIGIN` is not needed: the site and its API are on the same host. Setting it to the site's own URL is harmless.
- Keep a copy of `JWT_SECRET` and `SETTINGS_ENCRYPTION_KEY` in your password manager. If `SETTINGS_ENCRYPTION_KEY` is lost or changed, the saved email password must be re-entered in Settings.

### 15.5 Install and start

1. Install the runtime packages, either as the Git **additional deployment action** `npm install --omit=dev --no-audit --no-fund`, or on the Node.js page with **NPM install** (production mode installs runtime packages only). No build step, no Python or Visual Studio tools: the `.npmrc` that comes with the release stops npm from compiling `better-sqlite3`, which ships a Windows binary.
   If npm reports `EPERM` on files in `node_modules`, the running app has them open: **Disable Node.js**, install again, then enable it.
2. Click **Enable Node.js**, then **Restart App**.
3. Open `https://projects.encalmhospitality.com/api/system/ready`: it must show `{"status":"ready"}`.
4. **HTTPS:** Plesk → **SSL/TLS Certificates** → Let's Encrypt, and turn on *Redirect from HTTP to HTTPS*. Sign-in only works over HTTPS (secure cookies).
5. **First user:** the first start creates the standard accounts and writes their temporary passwords once to the newest log in the `iisnode` folder; sign in with one and change the password. To add someone later: in a shell in the application folder (RDP), with the same environment variables set, `node server/dist/create-user.js "Full Name" you@encalmhospitality.com "Temp-pass-123" coordinator` ([section 12](#12-users-and-passwords)).

### 15.6 If you get a 500 error

Open the domain's **Files** in Plesk → the `iisnode` folder inside the Application Root; the newest log file shows the real error. Common causes:

| Log says | Fix |
|---|---|
| `[Config] FATAL: JWT_SECRET …` or `SETTINGS_ENCRYPTION_KEY …` | Add or correct that variable (15.4), Restart App. |
| `SQLITE_CANTOPEN`, `EPERM` or `EACCES` on `C:\encalm-projects-data` | Folder missing or the domain user lacks Modify (15.2). |
| `Cannot find module …server\dist\index.js` / `Failed to start server (did you run "npm run build"?)` | Plesk is deploying `main` (source only) instead of `plesk-release`, or the release branch was not pulled (15.1). |
| `better_sqlite3.node` or `sharp` "could not load" / "was compiled against a different Node.js version" | Native modules do not match the Node version: Disable Node.js, delete `node_modules`, install again (15.5), enable. |
| npm: `gyp ERR! find Python` / `node-gyp rebuild` failed for `better-sqlite3` | The install ran without the release's `.npmrc` (an old checkout, or a command run outside the application folder). Pull `plesk-release` and install from the application folder. |
| npm: `EPERM: operation not permitted, rmdir …node_modules…` | Files are locked by the running app: Disable Node.js (or stop the application pool), run the install again, then enable and Restart App. |
| Build: `Cannot read directory "../../../..": Access is denied` | Something tried to build on the server. Do not run `npm run build` there; deploy `plesk-release` (15.1). |
| `ERR_ERL_UNDEFINED_IP_ADDRESS` (warning, not a 500) | iisnode is not forwarding client IPs, so all users share one rate limit. Check that `iisnode.yml` is next to `server.cjs`; if Plesk's `web.config` sets its own `<iisnode>` element, add `enableXFF="true"` to it. |

### 15.7 Updates, rollback, backups

- **Update:** merge to `main` → CI → the Plesk release workflow publishes `plesk-release` → Plesk **Pull Updates** (or the webhook) → install (15.5) → **Restart App**. Migrations run automatically when the app starts. Each release commit names the `main` commit it was built from (`SOURCE_COMMIT`).
- **Rollback:** there is no automatic rollback on Plesk. Before each update, back up `C:\encalm-projects-data`. To roll back, deploy the previous commit of `plesk-release` (Plesk Git can deploy a specific commit), reinstall, restart, and restore that backup if the update changed the database.
- **Backups:** include `C:\encalm-projects-data` in Plesk's **Backup Manager** (scheduled, with remote storage). For a guaranteed-consistent copy, stop the app first, or copy `encalm.db` together with its `-wal` and `-shm` files.
- **One process only:** `iisnode.yml` sets `nodeProcessCountPerApplication: 1`; do not raise it.

## 16. Reference

| Command | Purpose |
|---|---|
| `npm run build` | Build the web app (`dist/`) and the server (`server/dist/`) |
| `npm start` | Run the built server |
| `npm run migrate` | Apply pending database migrations |
| `npm run create-user -- …` | Create or update a user (section 12) |
| `npm run test:backup` | Backup/restore round trip in a temporary folder |
| `npm run lighthouse` | Lighthouse audit of the signed-in app (≥ 90 required) |
| `deploy/setup-vps.sh` | One-time server setup (`--dry-run` to preview) |
| `deploy/deploy.sh <env> [ref]` | Deploy (`DRY_RUN=1` to preview) |
| `deploy/rollback.sh <env> [release] [--restore-db stamp]` | Roll back |
| `scripts/backup.sh`, `scripts/restore.sh` | Backups |

- Every environment variable, with a comment: `.env.example`. Per-environment templates: `deploy/env/`.
- Health: `GET /api/system/ready` (public), `GET /api/system/health` (coordinator).
- Destructive endpoints `POST /api/system/reset` and `/clear` are coordinator-only and refused in production unless `ALLOW_SYSTEM_RESET=true`.
