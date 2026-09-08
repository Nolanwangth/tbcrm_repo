#!/bin/zsh

set -euo pipefail

DEPLOYMENT_ROOT="${1:-}"
IMPORT_CREDENTIALS="${2:-}"

if [ -z "$DEPLOYMENT_ROOT" ] || [ ! -f "$DEPLOYMENT_ROOT/server/manage.sh" ]; then
  printf '%s\n' '用法：provision-server-accounts.sh <服务器部署目录> [首台服务器credentials.txt]' >&2
  exit 1
fi

SERVER_DIR="$DEPLOYMENT_ROOT/server"
APP_DIR="$DEPLOYMENT_ROOT/app"
SUPABASE_DIR="$SERVER_DIR/supabase"
SUPABASE_ENV="$SUPABASE_DIR/.env"
BASE_COMPOSE="$SUPABASE_DIR/docker-compose.yml"
CRM_COMPOSE="$SERVER_DIR/docker-compose.tripbook.yml"
PROVISION_SCRIPT="$APP_DIR/scripts/provision-production-accounts.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
ACCOUNT_BACKUP_DIR="$DEPLOYMENT_ROOT/backups/account-provisioning-$STAMP"

for required in "$SUPABASE_ENV" "$BASE_COMPOSE" "$CRM_COMPOSE" "$PROVISION_SCRIPT"; do
  if [ ! -f "$required" ]; then
    printf '缺少服务器账号配置所需文件：%s\n' "$required" >&2
    exit 1
  fi
done

if [ -n "$IMPORT_CREDENTIALS" ] && [ ! -f "$IMPORT_CREDENTIALS" ]; then
  printf '找不到要导入的凭据文件：%s\n' "$IMPORT_CREDENTIALS" >&2
  exit 1
fi

mkdir -p "$ACCOUNT_BACKUP_DIR"
chmod 700 "$ACCOUNT_BACKUP_DIR"

compose=(docker compose --project-name tripbook-crm --env-file "$SUPABASE_ENV" -f "$BASE_COMPOSE" -f "$CRM_COMPOSE")

if [ -n "$IMPORT_CREDENTIALS" ]; then
  "${compose[@]}" run --rm --no-deps \
    -v "$PROVISION_SCRIPT:/app/provision-production-accounts.mjs:ro" \
    -v "$IMPORT_CREDENTIALS:/credentials/input.txt:ro" \
    crm node /app/provision-production-accounts.mjs --credentials /credentials/input.txt
  /usr/bin/install -m 600 "$IMPORT_CREDENTIALS" "$ACCOUNT_BACKUP_DIR/credentials.txt"
else
  "${compose[@]}" run --rm --no-deps \
    -v "$PROVISION_SCRIPT:/app/provision-production-accounts.mjs:ro" \
    -v "$ACCOUNT_BACKUP_DIR:/credentials" \
    crm node /app/provision-production-accounts.mjs --output /credentials/credentials.txt
  chmod 600 "$ACCOUNT_BACKUP_DIR/credentials.txt"
fi

printf '正式账号配置完成，受限凭据位于：%s\n' "$ACCOUNT_BACKUP_DIR/credentials.txt"
