#!/bin/zsh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$HOME/.local/share/npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
screen -S tripbook-crm-local -X quit >/dev/null 2>&1 || true
listener="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
[ -z "$listener" ] || kill $listener 2>/dev/null || true
cd "$APP_DIR"
mkdir -p .next/standalone/.next
[ ! -d .next/static ] || /usr/bin/ditto .next/static .next/standalone/.next/static
[ ! -d public ] || /usr/bin/ditto public .next/standalone/public
exec env PORT=3000 HOSTNAME=0.0.0.0 node --env-file=.env.local .next/standalone/server.js
