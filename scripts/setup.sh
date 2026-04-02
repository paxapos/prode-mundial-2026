#!/usr/bin/env sh
set -eu

echo "[setup] Installing dependencies"
pnpm install

echo "[setup] Running health smoke test"
pnpm smoke:health

echo "[setup] Validating required tables and migration version"
pnpm smoke:db

echo "[setup] Running project checks"
pnpm check

echo "[setup] Project is ready"
