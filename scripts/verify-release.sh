#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== TDBK V2 Release Gate =="

echo "[1/2] Master integration"
npm run test:phase7

echo "[2/2] Full engineering verification"
npm run verify:engineering

echo "== RELEASE GATE PASSED =="
