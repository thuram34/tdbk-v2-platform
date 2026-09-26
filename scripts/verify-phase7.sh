#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== TDBK V2: Phase 7 master integration gate =="
npm run test:phase7
echo "== Phase 7 gate PASSED =="
