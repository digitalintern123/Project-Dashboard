# Encalm Project Dashboard — Production Runbook

This runbook guides operators through deploying, managing, and maintaining the **Encalm Project Dashboard** in an enterprise production environment.

---

## 1. Architecture Overview

- **Frontend**: React 19 SPA built with Vite, Tailwind CSS v4, Radix UI, and Lucide icons.
- **Backend**: Node.js / Express 5 API running with TypeScript (`tsx`), helmet security headers, gzip/deflate compression, and rate limiting.
- **Database**: Embedded SQLite (`encalm.db`) operating with Write-Ahead Logging (`WAL`), foreign key enforcement, 64MB memory query caching, and automated JSON disaster-recovery snapshots (`portfolio-database.json`).
- **File Storage**: Local persistent filesystem storage for site photos under `server/data/uploads`.
- **Integrations**: Microsoft Graph API and SMTP for notifications and email outbox delivery.

---

## 2. Prerequisites & System Requirements

- **Node.js**: v20.x or v22.x LTS
- **Memory**: Minimum 512 MB RAM (1 GB recommended)
- **Disk**: 1 GB+ for application and uploaded photos
- **Network**: Port `5000` (or reverse proxy on `80`/`443`)

---

## 3. Deployment Methods

### Option A: Docker / Docker Compose (Recommended)

1. **Clone repository and configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with strong JWT_SECRET, SMTP credentials, etc.
   ```

2. **Launch with Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

3. **Check container status and logs**:
   ```bash
   docker compose ps
   docker compose logs -f encalm-dashboard
   ```

4. **Verify health**:
   ```bash
   curl http://localhost:5000/api/system/health
   curl http://localhost:5000/api/system/ready
   ```

---

### Option B: Bare-Metal / Virtual Machine (PM2 / Systemd)

1. **Install dependencies**:
   ```bash
   npm ci
   ```

2. **Build frontend assets**:
   ```bash
   npm run build
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env
   ```

4. **Run with PM2**:
   ```bash
   npm install -g pm2
   pm2 start "npm run start" --name "encalm-dashboard" --time
   pm2 save
   pm2 startup
   ```

---

## 4. Reverse Proxy Setup (Nginx)

When deploying behind Nginx or an Application Gateway, use the following configuration snippet:

```nginx
server {
    listen 80;
    server_name projects.encalm.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name projects.encalm.com;

    ssl_certificate /etc/ssl/certs/encalm-projects.crt;
    ssl_certificate_key /etc/ssl/private/encalm-projects.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Security & Maintenance Operations

### Health Probes & Monitoring
- **Liveness Probe**: `GET /api/system/health`
  - Returns 200 with project counts, memory usage, uptime, and SQLite status.
- **Readiness Probe**: `GET /api/system/ready`
  - Returns 200 when SQLite database is responsive to queries.

### Backups and restore

Everything lives in `DATA_DIR` (default `server/data`): `encalm.db` (SQLite, WAL mode) and `uploads/` (photos).
Do **not** `cp` or `tar` a live `encalm.db`: with WAL that can capture a torn copy. Use the scripts below.

**Install once:** `sudo apt install sqlite3` (and `rclone` if you want off-server copies).

**Nightly backup** (`scripts/backup.sh`): online-safe SQLite backup with `integrity_check`, gzip, a tarball of
`uploads/`, SHA-256 checksums, 30-day local retention, and an optional rclone copy off the server.

```bash
# crontab -e   (as the app user)
15 2 * * * cd /opt/encalm && DATA_DIR=/opt/encalm/server/data BACKUP_DIR=/var/backups/encalm RCLONE_REMOTE=b2:encalm-backups/prod ./scripts/backup.sh >> /var/log/encalm/backup.log 2>&1
```

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./server/data` | Where `encalm.db` and `uploads/` live |
| `BACKUP_DIR` | `/var/backups/encalm` | Local backup folder |
| `RETENTION_DAYS` | `30` | Local copies older than this are deleted |
| `RCLONE_REMOTE` | (empty) | e.g. `b2:encalm-backups/prod`; set up with `rclone config` |
| `RCLONE_RETENTION_DAYS` | `RETENTION_DAYS` | Remote copies older than this are deleted |

**Restore** (`scripts/restore.sh`): verifies checksums and integrity, moves the current database and uploads
aside to `DATA_DIR/pre-restore-<time>/` (nothing is deleted), then puts the backup in place.

```bash
pm2 stop encalm-dashboard            # or: docker compose stop
./scripts/restore.sh                 # list backups
./scripts/restore.sh latest          # or a specific stamp, e.g. 20261012T021500Z
pm2 start encalm-dashboard
```

If the server itself is lost, first pull the files back: `rclone copy b2:encalm-backups/prod /var/backups/encalm --include 'encalm-<STAMP>*'`.

**Verify the round trip** at any time (uses a throwaway directory): `npm run test:backup`.

**Optional: continuous replication with Litestream.** For near-zero data loss between nightly backups, stream the
database to S3-compatible storage with Litestream. A sample config is in `deploy/litestream.yml`.

The JSON file `portfolio-database.json` is a convenience export of project data only (no users, sessions,
audit log or settings). It is not a backup.

### Destructive System Operations Guard
- `/api/system/reset`, `/clear` and `/import` are guarded by role authentication (Coordinator only).
- In production (`NODE_ENV=production`), these endpoints are strictly disabled unless `ALLOW_SYSTEM_RESET=true` is set in the environment.

---

## 6. Verification Checklist

- [x] Security headers active (Helmet)
- [x] Gzip compression active
- [x] Static assets cached immutably with hashed names
- [x] Rate limiting active on authentication and email endpoints
- [x] Upload extension whitelisting active (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`)
- [x] Graceful shutdown handling `SIGTERM` and `SIGINT` with WAL checkpoint
- [x] 100% test pass rate (`npm run test`)
