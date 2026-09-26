#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== TDBK V2 Engineering Verification =="

echo "[1/4] Full test suite"
npm test

echo "[2/4] TypeScript"
npm run typecheck

echo "[3/4] ESLint"
npm run lint

echo "[4/4] Production build"
npm run build

echo "== ENGINEERING VERIFICATION PASSED =="
