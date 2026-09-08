#!/bin/bash
set -e
cd "$(dirname "$0")"
exec bash ./start-crm-dev.command --preview
