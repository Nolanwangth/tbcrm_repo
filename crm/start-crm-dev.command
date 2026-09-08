#!/bin/bash
set -e


export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$HOME/.local/share/npm-global/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRM_PORT=3001

echo "========================================"
echo "  Tripbook CRM Dev 启动脚本"
echo "========================================"

echo ""
echo "[1/3] 检查 Docker..."
if ! docker info &>/dev/null; then
  echo "  Docker 未运行，正在启动 Docker Desktop..."
  open -a Docker
  echo -n "  等待 Docker 就绪"
  for i in $(seq 1 20); do
    if docker info &>/dev/null; then
      echo " ✓"
      break
    fi
    echo -n "."
    sleep 3
  done
  if ! docker info &>/dev/null; then
    echo " ✗ Docker 启动超时，请手动启动后重试"
    exit 1
  fi
else
  echo "  Docker 已运行 ✓"
fi

echo ""
echo "[2/3] 启动本地 Supabase..."
cd "$PROJECT_DIR"

pnpm supabase start

echo ""
echo "[3/3] 启动 CRM 开发服务器..."
node --env-file=.env.local scripts/start-local-crm.mjs "$@"
