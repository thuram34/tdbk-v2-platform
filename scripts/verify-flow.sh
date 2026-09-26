#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
echo "== TDBK V2: Flow orchestration gate =="
npm run test:flow
echo "== Flow orchestration gate PASSED =="\n