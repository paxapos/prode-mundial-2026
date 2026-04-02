#!/usr/bin/env bash
set -euo pipefail

# Deploy SvelteKit (adapter-node) to Cloud Run using source build.
# This is the quickest server deployment path in the Firebase/GCP ecosystem.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${1:-${PROJECT_ROOT}/.env.cloudrun}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Missing gcloud CLI. Install it before running this deploy script." >&2
  exit 1
fi

: "${GCP_PROJECT_ID:?Missing GCP_PROJECT_ID}"
: "${TURSO_DATABASE_URL:?Missing TURSO_DATABASE_URL}"

SERVICE_NAME="${SERVICE_NAME:-prode-mundial-2026}"
GCP_REGION="${GCP_REGION:-us-central1}"
SESSION_DURATION_DAYS="${SESSION_DURATION_DAYS:-30}"
TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

ENV_VARS="NODE_ENV=production,SESSION_DURATION_DAYS=${SESSION_DURATION_DAYS},TURSO_DATABASE_URL=${TURSO_DATABASE_URL},TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}"
if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
  ENV_VARS="${ENV_VARS},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
fi
if [[ -n "${GOOGLE_CLIENT_SECRET}" ]]; then
  ENV_VARS="${ENV_VARS},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
fi

cd "${PROJECT_ROOT}"

echo "Deploying service ${SERVICE_NAME} in project ${GCP_PROJECT_ID} (${GCP_REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${GCP_PROJECT_ID}" --region "${GCP_REGION}" --format='value(status.url)')"

echo "Setting ORIGIN=${SERVICE_URL}..."
FINAL_ENV="ORIGIN=${SERVICE_URL},SESSION_DURATION_DAYS=${SESSION_DURATION_DAYS},TURSO_DATABASE_URL=${TURSO_DATABASE_URL},TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}"
if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
  FINAL_ENV="${FINAL_ENV},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
fi
if [[ -n "${GOOGLE_CLIENT_SECRET}" ]]; then
  FINAL_ENV="${FINAL_ENV},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
fi
gcloud run services update "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --update-env-vars "${FINAL_ENV}"

echo "Done. Your app is live at: ${SERVICE_URL}"
