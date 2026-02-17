#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

targets=(
  "dist"
  "src-tauri/target"
  "src-tauri/gen"
  ".cache"
  ".vite"
  "node_modules/.vite"
)

removed=0
for rel in "${targets[@]}"; do
  abs="$ROOT/$rel"
  if [ -e "$abs" ]; then
    rm -rf "$abs"
    echo "removed $rel"
    removed=1
  fi
done

if [ "$removed" -eq 0 ]; then
  echo "nothing to remove"
fi
