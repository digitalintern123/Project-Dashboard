#!/usr/bin/env bash
# Encalm Project Dashboard: one-time setup of a fresh Ubuntu 22.04/24.04 VPS.
# Run as root (or with sudo). Safe to re-run: every step checks before it acts,
# and secrets are generated once and never overwritten.
#
#   sudo deploy/setup-vps.sh --domain projects.example.com --email ops@example.com \
#        --repo git@github.com:digitalintern123/Project-Dashboard.git [--env production]
#
#   --dry-run            print what would be done, change nothing
#   --env staging        set up the staging environment (port 5001) instead
#   --ci-pubkey "ssh-ed25519 AAAA..."   authorise the GitHub Actions deploy key
#   --skip-ssh-hardening leave sshd settings alone
#   --skip-certbot       skip the certificate (e.g. DNS not pointed yet); re-run later
#   --skip-deploy        stop before the first deploy
#
# What it does: Node 22 LTS, PM2, nginx, certbot, sqlite3, ufw (22/80/443 only),
# fail2ban, unattended-upgrades, an "encalm" app user, key-only SSH, directories,
# the env file with generated secrets, the nginx site + Let's Encrypt
# certificate, log rotation, PM2 on boot, nightly backups, and the first deploy.
set -euo pipefail

DOMAIN=""
EMAIL=""
REPO_URL=""
ENV_NAME="production"
CI_PUBKEY=""
DRY_RUN=0
SKIP_SSH=0
SKIP_CERT=0
SKIP_DEPLOY=0
APP_USER="encalm"
ROOT="/opt/encalm"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --env) ENV_NAME="$2"; shift 2 ;;
    --ci-pubkey) CI_PUBKEY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-ssh-hardening) SKIP_SSH=1; shift ;;
    --skip-certbot) SKIP_CERT=1; shift ;;
    --skip-deploy) SKIP_DEPLOY=1; shift ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$ENV_NAME" in
  production) PORT=5000 ;;
  staging) PORT=5001 ;;
  *) echo "--env must be production or staging" >&2; exit 2 ;;
esac
[ -n "$DOMAIN" ] || { echo "--domain is required" >&2; exit 2; }
[ -n "$REPO_URL" ] || { echo "--repo is required" >&2; exit 2; }
[ "$SKIP_CERT" = 1 ] || [ -n "$EMAIL" ] || { echo "--email is required for Let's Encrypt (or --skip-certbot)" >&2; exit 2; }

DATA_DIR="/var/lib/encalm/$ENV_NAME"
BACKUP_DIR="/var/backups/encalm/$ENV_NAME"
ENV_FILE="/etc/encalm/$ENV_NAME.env"
SITE="/etc/nginx/sites-available/encalm-$ENV_NAME.conf"

step() { echo; echo "==> $*"; }
note() { echo "    $*"; }
run() {
  if [ "$DRY_RUN" = 1 ]; then echo "    + $*"; else "$@"; fi
}
as_app() {
  if [ "$DRY_RUN" = 1 ]; then echo "    + (as $APP_USER) $*"; else sudo -u "$APP_USER" -H bash -lc "$*"; fi
}
write_file() { # write_file <path> <mode> <owner>  (content on stdin)
  local path="$1" mode="$2" owner="$3"
  if [ "$DRY_RUN" = 1 ]; then echo "    + write $path ($mode $owner)"; cat >/dev/null; return; fi
  local tmp; tmp="$(mktemp)"
  cat > "$tmp"
  install -m "$mode" -o "${owner%:*}" -g "${owner#*:}" "$tmp" "$path"
  rm -f "$tmp"
}

[ "$DRY_RUN" = 1 ] && echo "DRY RUN: nothing will be changed."
[ "$DRY_RUN" = 1 ] || [ "$(id -u)" = 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }
. /etc/os-release 2>/dev/null || true
[ "${ID:-}" = ubuntu ] || note "WARNING: written for Ubuntu; this is ${PRETTY_NAME:-unknown}."

# 1. Packages -------------------------------------------------------------------
step "System packages"
export DEBIAN_FRONTEND=noninteractive
run apt-get update -q
run apt-get install -y -q ca-certificates curl git gnupg nginx certbot sqlite3 ufw fail2ban \
  unattended-upgrades logrotate build-essential python3 rsync
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 22 ]; then
  note "Installing Node.js 22 LTS from NodeSource"
  if [ "$DRY_RUN" = 1 ]; then
    echo "    + curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  fi
  run apt-get install -y -q nodejs
else
  note "Node $(node -v) already installed"
fi
command -v pm2 >/dev/null || run npm install -g pm2@5

# 2. Automatic security updates --------------------------------------------------
step "Unattended security upgrades"
write_file /etc/apt/apt.conf.d/20auto-upgrades 0644 root:root <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
run systemctl enable --now unattended-upgrades

# 3. App user and directories ----------------------------------------------------
step "App user '$APP_USER' and directories"
if ! id "$APP_USER" >/dev/null 2>&1; then
  run useradd --system --create-home --home-dir "$ROOT" --shell /bin/bash "$APP_USER"
fi
run install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$ROOT" "$ROOT/$ENV_NAME" "$ROOT/$ENV_NAME/releases"
run install -d -m 0750 -o "$APP_USER" -g "$APP_USER" /var/lib/encalm "$DATA_DIR" /var/backups/encalm "$BACKUP_DIR"
run install -d -m 0750 -o "$APP_USER" -g adm /var/log/encalm
run install -d -m 0750 -o root -g "$APP_USER" /etc/encalm
run install -d -m 0755 /var/www/certbot
run install -m 0644 -o "$APP_USER" -g "$APP_USER" "$SRC_DIR/deploy/ecosystem.config.cjs" "$ROOT/ecosystem.config.cjs"

# 4. SSH: keys for GitHub, CI, and key-only login --------------------------------------
step "SSH keys"
run install -d -m 0700 -o "$APP_USER" -g "$APP_USER" "$ROOT/.ssh"
if [[ "$REPO_URL" == git@* ]] && [ ! -f "$ROOT/.ssh/github_deploy" ]; then
  as_app "ssh-keygen -t ed25519 -N '' -C 'encalm-vps-deploy' -f ~/.ssh/github_deploy -q"
  write_file "$ROOT/.ssh/config" 0600 "$APP_USER:$APP_USER" <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
fi
if [ -n "$CI_PUBKEY" ]; then
  if [ "$DRY_RUN" = 1 ]; then
    echo "    + append CI public key to $ROOT/.ssh/authorized_keys"
  elif ! grep -qF "$CI_PUBKEY" "$ROOT/.ssh/authorized_keys" 2>/dev/null; then
    echo "$CI_PUBKEY" >> "$ROOT/.ssh/authorized_keys"
    chown "$APP_USER:$APP_USER" "$ROOT/.ssh/authorized_keys"; chmod 600 "$ROOT/.ssh/authorized_keys"
  fi
fi

if [ "$SKIP_SSH" = 0 ]; then
  # Refuse to disable passwords unless someone can already log in with a key.
  if compgen -G "/root/.ssh/authorized_keys" >/dev/null || compgen -G "/home/*/.ssh/authorized_keys" >/dev/null; then
    write_file /etc/ssh/sshd_config.d/99-encalm-hardening.conf 0644 root:root <<'EOF'
# Managed by Encalm setup-vps.sh: key-only SSH.
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 4
EOF
    run sshd -t
    run systemctl reload ssh
  else
    note "SKIPPED key-only SSH: no authorized_keys for root or any user yet."
    note "Add your public key first (ssh-copy-id), then re-run this script."
  fi
fi

# 5. Firewall and fail2ban ---------------------------------------------------------
step "Firewall (22, 80, 443 only) and fail2ban"
run ufw default deny incoming
run ufw default allow outgoing
run ufw allow 22/tcp
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw --force enable
write_file /etc/fail2ban/jail.d/encalm.local 0644 root:root <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
banaction = ufw

[sshd]
enabled = true

[nginx-limit-req]
enabled = true
logpath = /var/log/nginx/encalm-*.error.log
EOF
run systemctl enable --now fail2ban
run systemctl restart fail2ban

# 6. Environment file (secrets generated once) ---------------------------------------
step "Environment file $ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  note "exists; left unchanged"
else
  JWT="$(openssl rand -base64 48 | tr -d '\n')"
  KEY="$(openssl rand -base64 32 | tr -d '\n')"
  write_file "$ENV_FILE" 0640 "root:$APP_USER" <<EOF
# Encalm Project Dashboard: $ENV_NAME. Generated by setup-vps.sh on $(date -u +%F).
# See .env.example in the repository for every option. Keep this file private.
NODE_ENV=production
APP_BASE_URL=https://$DOMAIN
DATA_DIR=$DATA_DIR
JWT_SECRET=$JWT
SETTINGS_ENCRYPTION_KEY=$KEY
COOKIE_DOMAIN=
CORS_ORIGIN=
ALLOW_SYSTEM_RESET=false

# Error tracking (optional)
SENTRY_DSN=

# Email: Microsoft 365 (preferred; set here only, see PRODUCTION.md "Email")
MS_GRAPH_TENANT_ID=
MS_GRAPH_CLIENT_ID=
MS_GRAPH_CLIENT_SECRET=
MS_GRAPH_SENDER_EMAIL=
MS_GRAPH_SEND_AS_DOMAINS=
# or SMTP (also editable in the app's Email settings)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Off-site backups (optional), e.g. b2:encalm-backups/$ENV_NAME after "rclone config"
RCLONE_REMOTE=
EOF
  note "generated JWT_SECRET and SETTINGS_ENCRYPTION_KEY. Back this file up somewhere safe."
fi

# 7. Nginx + certificate -------------------------------------------------------------
step "Nginx site for $DOMAIN"
run rm -f /etc/nginx/sites-enabled/default
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Bootstrap: plain HTTP so certbot can answer the challenge.
  write_file "$SITE" 0644 root:root <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 503; }
}
EOF
  run ln -sfn "$SITE" "/etc/nginx/sites-enabled/encalm-$ENV_NAME.conf"
  run nginx -t
  run systemctl reload nginx
  if [ "$SKIP_CERT" = 1 ]; then
    note "SKIPPED certificate. Point $DOMAIN at this server, then re-run without --skip-certbot."
  else
    run certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --email "$EMAIL" \
      --agree-tos --no-eff-email --non-interactive \
      || { note "certbot failed: is the DNS A record for $DOMAIN pointing here yet? Re-run when it is."; exit 1; }
  fi
fi
if [ "$DRY_RUN" = 1 ] || [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  RENDERED="$(sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" -e "s/__ENV__/$ENV_NAME/g" "$SRC_DIR/deploy/nginx.conf")"
  # Hosts without IPv6 cannot bind [::]; nginx would refuse to start.
  [ -e /proc/net/if_inet6 ] || RENDERED="$(echo "$RENDERED" | sed '/listen \[::\]/d')"
  echo "$RENDERED" | write_file "$SITE" 0644 root:root
  run ln -sfn "$SITE" "/etc/nginx/sites-enabled/encalm-$ENV_NAME.conf"
  run nginx -t
  run systemctl reload nginx
  # Renewals (certbot's systemd timer) reload nginx afterwards.
  write_file /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh 0755 root:root <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
fi

# 8. Log rotation, PM2 on boot, nightly backups ----------------------------------------
step "Log rotation, PM2 startup, nightly backup"
run install -m 0644 "$SRC_DIR/deploy/logrotate.conf" /etc/logrotate.d/encalm
run env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "$ROOT"
CRON_LINE="15 2 * * * cd $ROOT/$ENV_NAME/current && DATA_DIR=$DATA_DIR BACKUP_DIR=$BACKUP_DIR RCLONE_REMOTE=\$(sed -n 's/^RCLONE_REMOTE=//p' $ENV_FILE) ./scripts/backup.sh >> /var/log/encalm/backup-$ENV_NAME.log 2>&1"
if [ "$DRY_RUN" = 1 ]; then
  echo "    + crontab ($APP_USER): $CRON_LINE"
elif ! crontab -u "$APP_USER" -l 2>/dev/null | grep -qF "backup-$ENV_NAME.log"; then
  (crontab -u "$APP_USER" -l 2>/dev/null; echo "$CRON_LINE") | crontab -u "$APP_USER" -
fi

# 9. Code checkout and first deploy ------------------------------------------------------
step "Repository and first deploy"
if [ ! -d "$ROOT/repo/.git" ]; then
  if ! as_app "GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git clone --quiet '$REPO_URL' '$ROOT/repo'"; then
    note "Could not clone $REPO_URL."
    if [ -f "$ROOT/.ssh/github_deploy.pub" ]; then
      note "Add this key as a read-only Deploy key (GitHub > repo > Settings > Deploy keys), then re-run:"
      note "$(cat "$ROOT/.ssh/github_deploy.pub")"
    fi
    exit 1
  fi
fi
if [ "$SKIP_DEPLOY" = 1 ]; then
  note "SKIPPED first deploy. Run: sudo -u $APP_USER $ROOT/repo/deploy/deploy.sh $ENV_NAME main"
else
  as_app "$ROOT/repo/deploy/deploy.sh $ENV_NAME main"
fi

step "Done"
note "Site:         https://$DOMAIN"
note "Env file:     $ENV_FILE (secrets; back it up)"
note "Data:         $DATA_DIR    Backups: $BACKUP_DIR"
note "Logs:         pm2 logs encalm-$ENV_NAME   /var/log/encalm/"
note "First user:   sudo -u $APP_USER bash -c 'cd $ROOT/$ENV_NAME/current && DOTENV_CONFIG_PATH=$ENV_FILE npm run create-user -- \"Full Name\" you@company.com \"Temp-pass-123\" coordinator'"
