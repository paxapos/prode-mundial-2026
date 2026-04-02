#!/usr/bin/env bash
# Deploy SvelteKit to Cloud Run + Firebase Hosting (custom domain).
# Run: pnpm deploy:firebase   OR   ./scripts/deploy-firebase.sh [env-file]
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${1:-${PROJECT_ROOT}/.env.cloudrun}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# ── Validations ──────────────────────────────────────────────────────────────
for cmd in gcloud firebase; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing CLI: ${cmd}. Run: npm install -g firebase-tools" >&2
    exit 1
  fi
done

: "${GCP_PROJECT_ID:?Missing GCP_PROJECT_ID in ${ENV_FILE}}"
: "${TURSO_DATABASE_URL:?Missing TURSO_DATABASE_URL in ${ENV_FILE}}"

# ── Config ───────────────────────────────────────────────────────────────────
SERVICE_NAME="${SERVICE_NAME:-prode-mundial-2026}"
GCP_REGION="${GCP_REGION:-us-central1}"
SESSION_DURATION_DAYS="${SESSION_DURATION_DAYS:-30}"
TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
ORIGIN="${ORIGIN:-https://mundial2026.club}"

# ── 1) Deploy Cloud Run (SSR backend) ────────────────────────────────────────
echo ""
echo "▶ Step 1/3 — Deploying Cloud Run service: ${SERVICE_NAME}"

ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},SESSION_DURATION_DAYS=${SESSION_DURATION_DAYS}"
ENV_VARS="${ENV_VARS},TURSO_DATABASE_URL=${TURSO_DATABASE_URL}"
ENV_VARS="${ENV_VARS},TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}"
ENV_VARS="${ENV_VARS},ORIGIN=${ORIGIN}"

if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
  ENV_VARS="${ENV_VARS},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
fi
if [[ -n "${GOOGLE_CLIENT_SECRET}" ]]; then
  ENV_VARS="${ENV_VARS},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
fi

cd "${PROJECT_ROOT}"

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}"

RUN_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

echo "✓ Cloud Run deployed at: ${RUN_URL}"

# ── 2) Enable Cloud Run ingress from Firebase Hosting ────────────────────────
echo ""
echo "▶ Step 2/3 — Allowing Firebase Hosting ingress on Cloud Run service"

gcloud run services update "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --ingress all 2>/dev/null || true

# ── 3) Deploy Firebase Hosting ────────────────────────────────────────────────
echo ""
echo "▶ Step 3/3 — Deploying Firebase Hosting (domain proxy)"

firebase deploy --only hosting --project "${GCP_PROJECT_ID}"

echo ""
echo "✅ Deploy complete!"
echo "   Cloud Run:        ${RUN_URL}"
echo "   Firebase Hosting: https://${PROJECT_ID}.web.app (disponible ya)"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Para conectar mundial2026.club (DNS en Namecheap):"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  1) Agregar dominio en Firebase Console:"
echo "     firebase hosting:channel:deploy production 2>/dev/null || true"
echo "     Luego: Console → Hosting → Add custom domain → mundial2026.club"
echo ""
echo "  2) O directo a la URL:"
echo "     https://console.firebase.google.com/project/${GCP_PROJECT_ID}/hosting/sites"
echo ""
echo "  3) Firebase te dará 2 registros DNS tipo A. En Namecheap:"
echo "     Domain List → mundial2026.club → Manage → Advanced DNS"
echo "     Agregar los registros que Firebase indique."
echo ""
