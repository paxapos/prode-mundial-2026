#!/usr/bin/env bash
# =============================================================================
# setup-prod.sh — Setup completo de GCP + Firebase + Google OAuth desde CLI
# Uso: ./scripts/setup-prod.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.cloudrun"

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

step() { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✓ $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()  { echo -e "${RED}✗ $*${RESET}" >&2; exit 1; }

# ── Requisitos ────────────────────────────────────────────────────────────────
for cmd in gcloud firebase curl jq; do
  command -v "${cmd}" >/dev/null 2>&1 || die "Falta: ${cmd}. Instalalo primero."
done

# ── Cuenta activa ─────────────────────────────────────────────────────────────
ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  gcloud auth login
  ACTIVE_ACCOUNT="$(gcloud config get-value account)"
fi
ok "Cuenta: ${ACTIVE_ACCOUNT}"

# ── 1) Proyecto GCP ───────────────────────────────────────────────────────────
step "1/7 — Proyecto GCP"

echo ""
echo "Proyectos existentes en tu cuenta:"
gcloud projects list --format="table(projectId,name)" 2>/dev/null | head -20 || true

DEFAULT_PROJECT_ID="prode-mundial-2026-club"

echo ""
echo -e "${YELLOW}Usando por defecto el proyecto existente:${RESET} ${BOLD}${DEFAULT_PROJECT_ID}${RESET}"
echo ""
read -rp "$(echo -e "${BOLD}Project ID${RESET} [${DEFAULT_PROJECT_ID}]: ")" PROJECT_ID
PROJECT_ID="${PROJECT_ID:-${DEFAULT_PROJECT_ID}}"
PROJECT_ID="${PROJECT_ID// /-}"
PROJECT_ID="$(echo "${PROJECT_ID}" | tr '[:upper:]' '[:lower:]')"

if gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
  # El proyecto ya existe — verificar que es nuestro
  OWNER_ACCOUNT="$(gcloud projects get-iam-policy "${PROJECT_ID}" --flatten="bindings[].members" \
    --filter="bindings.role=roles/owner" --format='value(bindings.members)' 2>/dev/null | head -1 || echo '')"
  ok "Usando proyecto existente: ${PROJECT_ID}"
else
  # Intentar crear
  echo "Creando proyecto ${PROJECT_ID}..."
  CREATE_OUT=$(gcloud projects create "${PROJECT_ID}" --name="Prode Mundial 2026" 2>&1)
  CREATE_EXIT=$?
  if [[ ${CREATE_EXIT} -ne 0 ]]; then
    if echo "${CREATE_OUT}" | grep -q "already in use"; then
      echo ""
      echo -e "${RED}✗ El ID '${PROJECT_ID}' ya está tomado globalmente por otro proyecto GCP.${RESET}"
      echo -e "  Si este proyecto ya existe y es tuyo, usá: ${BOLD}prode-mundial-2026-club${RESET}"
      echo ""
      read -rp "$(echo -e "${BOLD}Nuevo Project ID${RESET}: ")" PROJECT_ID
      PROJECT_ID="${PROJECT_ID// /-}"
      PROJECT_ID="$(echo "${PROJECT_ID}" | tr '[:upper:]' '[:lower:]')"
      gcloud projects create "${PROJECT_ID}" --name="Prode Mundial 2026" 2>&1 || \
        die "No se pudo crear el proyecto '${PROJECT_ID}'. Verificá que el ID esté disponible en: https://console.cloud.google.com/projectcreate"
    else
      echo "${CREATE_OUT}" >&2
      die "Error al crear el proyecto."
    fi
  fi
  ok "Proyecto creado: ${PROJECT_ID}"
fi

gcloud config set project "${PROJECT_ID}"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
ok "Project Number: ${PROJECT_NUMBER}"

# ── 2) Billing ────────────────────────────────────────────────────────────────
step "2/7 — Billing"

# Verificar si ya tiene billing
BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo 'False')"
if [[ "${BILLING_ENABLED}" == "True" ]]; then
  ok "Billing ya activo"
else
  while [[ "${BILLING_ENABLED}" != "True" ]]; do
    echo "Cuentas de billing disponibles:"
    gcloud billing accounts list --format="table(name,displayName,open)" 2>/dev/null || warn "Sin cuentas de billing visibles"
    echo ""
    read -rp "$(echo -e "${BOLD}Billing Account ID${RESET} (ej: 012345-ABCDEF-012345): ")" BILLING_ACCOUNT

    if [[ -z "${BILLING_ACCOUNT}" ]]; then
      die "Billing es obligatorio para Cloud Run. Ejecutá de nuevo y elegí una cuenta de billing."
    fi

    if LINK_OUTPUT="$(gcloud billing projects link "${PROJECT_ID}" --billing-account="${BILLING_ACCOUNT}" 2>&1)"; then
      ok "Billing vinculado"
    else
      warn "No se pudo vincular billing con ${BILLING_ACCOUNT}."
      echo "${LINK_OUTPUT}"
      if echo "${LINK_OUTPUT}" | grep -qi "billing quota exceeded"; then
        warn "Esa cuenta alcanzó su cuota de proyectos. Probá otra cuenta de billing o pedí aumento de cuota."
      fi
    fi

    BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo 'False')"
    if [[ "${BILLING_ENABLED}" != "True" ]]; then
      echo ""
      read -rp "Reintentar con otra cuenta de billing? [S/n]: " RETRY_BILLING
      RETRY_BILLING="${RETRY_BILLING:-S}"
      if [[ ! "${RETRY_BILLING}" =~ ^[Ss]$ ]]; then
        die "No se puede continuar sin billing activo en el proyecto ${PROJECT_ID}."
      fi
    fi
  done
fi

# Guard final antes de activar APIs
BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo 'False')"
if [[ "${BILLING_ENABLED}" != "True" ]]; then
  die "Billing no está activo para ${PROJECT_ID}. Activá billing y volvé a ejecutar el setup."
fi

# ── 3) Habilitar APIs ─────────────────────────────────────────────────────────
step "3/7 — Habilitando APIs"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  iap.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

ok "APIs habilitadas"

# ── 4) Firebase Hosting ───────────────────────────────────────────────────────
step "4/7 — Firebase Hosting"

# Asegurar .firebaserc valido antes de ejecutar comandos firebase
cat > "${PROJECT_ROOT}/.firebaserc" <<EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF
ok ".firebaserc actualizado → ${PROJECT_ID}"

firebase login --no-localhost 2>/dev/null || firebase login

# Añadir Firebase al proyecto GCP (crea el sitio de hosting)
firebase projects:addfirebase "${PROJECT_ID}" --project "${PROJECT_ID}" 2>/dev/null && ok "Firebase añadido al proyecto" || \
  ok "Firebase ya estaba configurado en ${PROJECT_ID}"

# ── 5) Google OAuth credentials ───────────────────────────────────────────────
step "5/7 — Credenciales Google OAuth"

ACCESS_TOKEN="$(gcloud auth print-access-token)"
DOMAIN="${DOMAIN:-mundial2026.club}"

# Habilitar la API de Identity Platform (necesaria para OAuth consent)
echo "Habilitando API oauth2..."
gcloud services enable oauth2.googleapis.com --project "${PROJECT_ID}" 2>/dev/null || true

# Configurar OAuth consent screen vía REST API
echo "Configurando OAuth consent screen..."
CONSENT_RESP=$(curl -s -X PUT \
  "https://oauth2.googleapis.com/v1/projects/${PROJECT_NUMBER}/brand" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"applicationTitle\":\"Prode Mundial 2026\",\"supportEmail\":\"${ACTIVE_ACCOUNT}\"}" 2>/dev/null || echo '{"error":"na"}')

if echo "${CONSENT_RESP}" | grep -q '"applicationTitle"'; then
  ok "Consent screen configurado"
else
  warn "Consent screen: respuesta inesperada (puede ya estar configurado, continuando...)"
fi

# Para crear OAuth Client ID tipo "Web Application" con redirect_uris custom,
# Google no expone endpoint REST público. Abrimos el browser directo al punto exacto.
echo ""
echo -e "${YELLOW}${BOLD}╔══════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${YELLOW}${BOLD}║  PASO RÁPIDO (30 seg): Crear OAuth Client ID en el browser       ║${RESET}"
echo -e "${YELLOW}${BOLD}╠══════════════════════════════════════════════════════════════════╣${RESET}"
echo -e "${YELLOW}║                                                                  ║${RESET}"
echo -e "${YELLOW}║  En la ventana que se abre:                                      ║${RESET}"
echo -e "${YELLOW}║  1) Application type: ${BOLD}Web application${RESET}${YELLOW}                          ║${RESET}"
echo -e "${YELLOW}║  2) Name: ${BOLD}prode-mundial-web${RESET}${YELLOW}                                   ║${RESET}"
echo -e "${YELLOW}║  3) Authorized redirect URIs → Agregar:                          ║${RESET}"
echo -e "${CYAN}║     https://${DOMAIN}/auth/google/callback${RESET}"
echo -e "${CYAN}║     https://${PROJECT_ID}.web.app/auth/google/callback${RESET}"
echo -e "${YELLOW}║  4) Click CREAR → Copiar Client ID y Client Secret               ║${RESET}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${RESET}"

OAUTH_URL="https://console.cloud.google.com/apis/credentials/oauthclient?project=${PROJECT_ID}"
echo -e "\nAbriendo browser en: ${CYAN}${OAUTH_URL}${RESET}"

# Abrir browser automáticamente
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${OAUTH_URL}" 2>/dev/null &
elif command -v open >/dev/null 2>&1; then
  open "${OAUTH_URL}" 2>/dev/null &
else
  echo "Abrí manualmente: ${OAUTH_URL}"
fi

echo ""
read -rp "$(echo -e "${BOLD}Pegá el Client ID${RESET} (ej: 123456789.apps.googleusercontent.com): ")" OAUTH_CLIENT_ID
read -rsp "$(echo -e "${BOLD}Pegá el Client Secret${RESET} (ej: GOCSPX-...): ")" OAUTH_CLIENT_SECRET
echo ""
: "${OAUTH_CLIENT_ID:?Client ID requerido}"
: "${OAUTH_CLIENT_SECRET:?Client Secret requerido}"
ok "Credenciales OAuth recibidas"

# ── 6) Turso DB ───────────────────────────────────────────────────────────────
step "6/7 — Base de datos Turso"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}" 2>/dev/null || true
fi

echo ""
read -rp "$(echo -e "${BOLD}TURSO_DATABASE_URL${RESET} [${TURSO_DATABASE_URL:-vacío}]: ")" INPUT_DB_URL
TURSO_DATABASE_URL="${INPUT_DB_URL:-${TURSO_DATABASE_URL:-}}"
: "${TURSO_DATABASE_URL:?Necesitás TURSO_DATABASE_URL}"

read -rp "$(echo -e "${BOLD}TURSO_AUTH_TOKEN${RESET} [${TURSO_AUTH_TOKEN:+***oculto***}]: ")" INPUT_DB_TOKEN
TURSO_AUTH_TOKEN="${INPUT_DB_TOKEN:-${TURSO_AUTH_TOKEN:-}}"

# ── Guardar .env.cloudrun ─────────────────────────────────────────────────────
cat > "${ENV_FILE}" <<EOF
# Generado por setup-prod.sh — $(date)
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=us-central1
SERVICE_NAME=prode-mundial-2026
ORIGIN=https://${DOMAIN}
SESSION_DURATION_DAYS=30
TURSO_DATABASE_URL=${TURSO_DATABASE_URL}
TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
GOOGLE_CLIENT_ID=${OAUTH_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
EOF
ok ".env.cloudrun guardado"

# ── 7) Deploy ─────────────────────────────────────────────────────────────────
step "7/7 — Deploy"

echo ""
read -rp "$(echo -e "${BOLD}¿Deployar ahora?${RESET} [S/n]: ")" DO_DEPLOY
DO_DEPLOY="${DO_DEPLOY:-S}"

if [[ "${DO_DEPLOY}" =~ ^[Ss]$ ]]; then
  bash "${SCRIPT_DIR}/deploy-firebase.sh" "${ENV_FILE}"
else
  echo ""
  ok "Variables guardadas. Para deployar después:"
  echo "  pnpm deploy:firebase"
fi

# ── Resumen final ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Setup completo ✓${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${RESET}"
echo ""
echo -e "  Proyecto GCP:   ${BOLD}${PROJECT_ID}${RESET}"
echo -e "  Dominio:        ${BOLD}https://${DOMAIN}${RESET}"
echo -e "  Variables:      ${BOLD}.env.cloudrun${RESET}"
echo ""
echo -e "${YELLOW}Próximo paso — DNS en Namecheap:${RESET}"
echo "  Firebase Console → Hosting → Agregar dominio → ${DOMAIN}"
echo "  Copiar records DNS → Advanced DNS en Namecheap"
echo ""
