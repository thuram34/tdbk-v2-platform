#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== TDBK V2: Phase 1 Blueprint / Business DNA security gate =="
npm run test:phase1
echo "== Phase 1 security gate PASSED =="
