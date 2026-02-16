#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LEAN_TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/orbitforge-lean.XXXXXX")"
export VITE_CACHE_DIR="$LEAN_TMP_ROOT/vite-cache"
export CARGO_TARGET_DIR="$LEAN_TMP_ROOT/cargo-target"

mkdir -p "$VITE_CACHE_DIR" "$CARGO_TARGET_DIR"

cleanup() {
  rm -rf "$LEAN_TMP_ROOT"
  "$ROOT/scripts/clean-heavy.sh" >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Lean dev mode enabled"
echo "VITE_CACHE_DIR=$VITE_CACHE_DIR"
echo "CARGO_TARGET_DIR=$CARGO_TARGET_DIR"

pnpm exec tauri dev "$@"
