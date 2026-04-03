# Deploy en Cloud Run con Google OAuth

Esta guía te lleva de cero a producción.

## Arquitectura

```
tu-dominio.com (o URL de Cloud Run)
    └── Cloud Run (SvelteKit SSR, Node.js)
            └── Turso (libSQL DB en la nube)
```

---

## Paso 1 — Crear proyecto GCP (una sola vez)

1. Ir a https://console.cloud.google.com/
2. Crear proyecto nuevo
3. Copiar el **Project ID** (ej: `mi-prode-xyz`)

---

## Paso 2 — Activar servicios GCP (una sola vez)

```bash
gcloud config set project TU_PROJECT_ID
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Paso 3 — Crear credenciales Google OAuth (una sola vez)

1. Ir a https://console.cloud.google.com/apis/credentials
2. Seleccionar el mismo proyecto
3. **Crear credencial** → OAuth 2.0 Client ID → Aplicación web
4. Nombre: ej. `Prode Mundial Web`
5. **Authorized JavaScript origins**:
   - `https://tu-dominio.com` (o la URL de Cloud Run)
6. **Authorized redirect URIs**:
   - `https://tu-dominio.com/auth/google/callback`
7. Copiar **Client ID** y **Client Secret**

> En desarrollo local, agrega también:
> - `http://localhost:5173` en origins
> - `http://localhost:5173/auth/google/callback` en redirect URIs

---

## Paso 4 — Configurar variables de entorno

```bash
cp .env.cloudrun.example .env.cloudrun
```

Editar `.env.cloudrun` con tus valores reales:

```env
GCP_PROJECT_ID=mi-prode-xyz
GCP_REGION=us-central1
SERVICE_NAME=prode-mundial
ORIGIN=https://tu-dominio.com
SESSION_DURATION_DAYS=30
TURSO_DATABASE_URL=libsql://tu-db.turso.io
TURSO_AUTH_TOKEN=tu-token-de-turso
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxx
```

---

## Paso 5 — Deploy a Cloud Run

```bash
pnpm deploy
```

El script hace:
1. Deploy del contenedor SvelteKit a **Cloud Run** via `gcloud run deploy --source .`
2. Configura las variables de entorno en Cloud Run
3. Obtiene la URL pública del servicio

---

## Paso 6 — Conectar dominio custom (opcional)

Si tenés un dominio propio, podés usar Cloud Run domain mappings:

```bash
gcloud beta run domain-mappings create \
  --service TU_SERVICE_NAME \
  --domain tu-dominio.com \
  --region us-central1
```

Luego configurá los registros DNS en tu proveedor apuntando a la IP que te indique GCP.

---

## Paso 7 — Actualizar DB (schema de Google OAuth)

Si es un deploy fresco con DB en Turso:
```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:push
```

Si ya tenés datos y querés aplicar solo la migración de Google OAuth:
```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:push --force
```

---

## Variables de entorno completas

| Variable | Requerida | Descripción |
|---|:---:|---|
| `TURSO_DATABASE_URL` | ✅ | URL de la base de datos Turso |
| `TURSO_AUTH_TOKEN` | ✅ | Token de autenticación Turso |
| `ORIGIN` | ✅ | URL pública de la app (ej: `https://tu-dominio.com`) |
| `SESSION_DURATION_DAYS` | ❌ | Duración sesión en días (default: 30) |
| `GOOGLE_CLIENT_ID` | ❌* | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ❌* | Client Secret de Google OAuth |

*Requeridas si se quiere habilitar login con Google. Si no se proveen, el botón de Google no aparece.

---

## Re-deploys rápidos

Una vez configurado todo, para actualizar la app:
```bash
pnpm deploy
```

---

## Costos estimados (100–200 visitas/día)

| Servicio | Costo estimado |
|---|---|
| Cloud Run | $3–12 USD/mes |
| Turso DB | Gratis (free tier: 500 DBs, 9 GB) |
| **Total** | **~$3–12 USD/mes** |

---

## Troubleshooting

**Error `oauth_state_mismatch`**: Limpiar cookies del browser e intentar de nuevo.

**Error `google_not_configured`**: Falta `GOOGLE_CLIENT_ID` en las variables de entorno del Cloud Run service.

**Dominio no resuelve**: Verificar que los registros DNS apuntan correctamente a Cloud Run. Puede tardar hasta 24h en propagarse.

**Cloud Run 403**: Verificar que el servicio tiene `--allow-unauthenticated` habilitado.
Forzarlo manualmente:
```bash
gcloud run services add-iam-policy-binding TU_SERVICE_NAME \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```
