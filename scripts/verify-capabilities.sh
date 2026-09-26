#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
echo "== TDBK V2: Capability Engineering Gate =="
echo "[1/3] Capability contract and nine-tier governance tests"
npx vitest run src/capability/tests/engineeringGovernance.test.ts
echo "[2/3] Capability regression suite"
npx vitest run src/capability/tests
echo "[3/3] TypeScript"
npm run typecheck
echo "== CAPABILITY ENGINEERING GATE PASSED =="
