#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/var/www/dairypro
APP_NAME=dairypro
STATE_DIR="$APP_DIR/.deploy-state"
DEPLOYED_FILE="$STATE_DIR/last-successful-commit"

cd "$APP_DIR"
mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/deploy.lock"
flock -w 900 9

test -f .env || { echo "Missing $APP_DIR/.env" >&2; exit 1; }

current_commit=$(git rev-parse HEAD)
previous_commit=$(cat "$DEPLOYED_FILE" 2>/dev/null || git rev-parse HEAD^ 2>/dev/null || printf '%s' "$current_commit")
schema_changed=0

if ! git diff --quiet "$previous_commit" "$current_commit" -- shared/schema.ts; then
  schema_changed=1
  if [ "${APPLY_SCHEMA_CHANGES:-0}" != 1 ]; then
    echo 'Database schema changed. Deployment stopped before restart; dispatch the workflow with apply_schema enabled after review.' >&2
    exit 1
  fi
fi

backup_dir="$STATE_DIR/dist.previous"
rm -rf "$backup_dir"
if [ -d dist ]; then cp -a dist "$backup_dir"; fi

npm ci --no-audit --no-fund

if [ "$schema_changed" = 1 ] || [ "${RESET_SUPER_ADMIN:-0}" = 1 ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  test -n "${DATABASE_URL:-}" || { echo 'DATABASE_URL is missing from the production environment.' >&2; exit 1; }
fi

if [ "$schema_changed" = 1 ]; then
  database_backup="$STATE_DIR/database-$(date -u +%Y%m%dT%H%M%SZ)-before-${current_commit:0:12}.dump"
  command -v psql >/dev/null || { echo 'psql is required to identify the production PostgreSQL version.' >&2; exit 1; }
  server_version_num=$(psql "$DATABASE_URL" --tuples-only --no-align --command='SHOW server_version_num')
  server_major=$((server_version_num / 10000))
  pg_dump_major=$(pg_dump --version 2>/dev/null | sed -nE 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/p')
  if [ "$pg_dump_major" = "$server_major" ]; then
    pg_dump "$DATABASE_URL" --format=custom --file="$database_backup"
  else
    command -v docker >/dev/null || { echo "PostgreSQL $server_major backup requires a matching pg_dump or Docker." >&2; exit 1; }
    backup_name=$(basename "$database_backup")
    docker run --rm --network host --user "$(id -u):$(id -g)" -v "$STATE_DIR:/backup" "postgres:$server_major" \
      pg_dump "$DATABASE_URL" --format=custom --file="/backup/$backup_name"
  fi
  test -s "$database_backup" || { echo 'Production database backup is empty; migration cancelled.' >&2; exit 1; }
  echo "Database backup created at $database_backup"
  npm run db:push
fi

if [ "${RESET_SUPER_ADMIN:-0}" = 1 ]; then
  test -n "${SUPER_ADMIN_BOOTSTRAP_PASSWORD:-}" || { echo 'The temporary Super Admin bootstrap secret is missing.' >&2; exit 1; }
  SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@dairyflow.com}" \
    SUPER_ADMIN_PASSWORD="$SUPER_ADMIN_BOOTSTRAP_PASSWORD" \
    npm exec tsx script/reset-superadmin.ts
  unset SUPER_ADMIN_BOOTSTRAP_PASSWORD SUPER_ADMIN_PASSWORD
fi

npm run build

rollback() {
  echo 'Health check failed; restoring the previous build.' >&2
  if [ -d "$backup_dir" ]; then
    rm -rf dist
    cp -a "$backup_dir" dist
    pm2 restart "$APP_NAME" --update-env || true
  fi
  exit 1
}

pm2 restart "$APP_NAME" --update-env
sleep 3
status=$(pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const a=JSON.parse(d).find(x=>x.name===process.argv[1]);process.stdout.write(a?.pm2_env?.status||"")})' "$APP_NAME")
[ "$status" = online ] || rollback

port=$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*["'\'' ]*([0-9]+).*/\1/p' .env | tail -1)
if [ -n "$port" ]; then
  for _ in 1 2 3 4 5; do
    curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/" >/dev/null && break
    sleep 2
  done
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/" >/dev/null || rollback
fi

printf '%s\n' "$current_commit" > "$DEPLOYED_FILE"
rm -rf "$backup_dir"
pm2 save
echo "Deployed $APP_NAME at $current_commit"
