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

if [ "$schema_changed" = 1 ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  test -n "${DATABASE_URL:-}" || { echo 'DATABASE_URL is missing from the production environment.' >&2; exit 1; }
  command -v pg_dump >/dev/null || { echo 'pg_dump is required before applying a production schema change.' >&2; exit 1; }
  database_backup="$STATE_DIR/database-$(date -u +%Y%m%dT%H%M%SZ)-before-${current_commit:0:12}.dump"
  pg_dump "$DATABASE_URL" --format=custom --file="$database_backup"
  test -s "$database_backup" || { echo 'Production database backup is empty; migration cancelled.' >&2; exit 1; }
  echo "Database backup created at $database_backup"
  npm run db:push
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
