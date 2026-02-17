#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/clean-heavy.sh"

if [ -d "$ROOT/node_modules" ]; then
  rm -rf "$ROOT/node_modules"
  echo "removed node_modules"
else
  echo "node_modules missing"
fi
