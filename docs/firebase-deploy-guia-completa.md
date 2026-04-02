# Deploy en Firebase Hosting + Cloud Run con Google OAuth

Esta guía te lleva de cero a producción en `mundial2026.club`.

## Arquitectura

```
mundial2026.club
    └── Firebase Hosting (SSL, CDN, dominio custom)
            └── Cloud Run (SvelteKit SSR, Node.js)
                    └── Turso (libSQL DB en la nube)
```

---

## Paso 1 — Crear proyecto Firebase (una sola vez)

1. Ir a https://console.firebase.google.com/
2. Crear proyecto nuevo → nombre ej: `prode-mundial-2026`
3. Copiar el **Project ID** (ej: `prode-mundial-2026-abc12`)

> El Project ID de Firebase = el Project ID de GCP. Los mismos.

---

## Paso 2 — Activar servicios GCP (una sola vez)

```bash
gcloud config set project TU_PROJECT_ID
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com
```

---

## Paso 3 — Crear credenciales Google OAuth (una sola vez)

1. Ir a https://console.cloud.google.com/apis/credentials
2. Seleccionar el mismo proyecto
3. **Crear credencial** → OAuth 2.0 Client ID → Aplicación web
4. Nombre: `Prode Mundial 2026`
5. **Authorized JavaScript origins**:
   - `https://mundial2026.club`
   - `https://TU_PROJECT_ID.web.app`  ← Firebase Hosting URL temporal
6. **Authorized redirect URIs**:
   - `https://mundial2026.club/auth/google/callback`
   - `https://TU_PROJECT_ID.web.app/auth/google/callback`  ← para pruebas
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
GCP_PROJECT_ID=prode-mundial-2026-abc12
GCP_REGION=us-central1
SERVICE_NAME=prode-mundial-2026
ORIGIN=https://mundial2026.club
SESSION_DURATION_DAYS=30
TURSO_DATABASE_URL=libsql://tu-db.turso.io
TURSO_AUTH_TOKEN=tu-token-de-turso
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxx
```

---

## Paso 5 — Login en Firebase CLI

```bash
firebase login
firebase use TU_PROJECT_ID
```

Esto actualiza `.firebaserc` con tu proyecto real. También puedes editar `.firebaserc` a mano.

---

## Paso 6 — Deploy completo (Cloud Run + Firebase Hosting)

```bash
pnpm deploy:firebase
```

El script hace:
1. Deploy del contenedor SvelteKit a **Cloud Run** via `gcloud run deploy --source .`
2. Configura las variables de entorno en Cloud Run
3. Hace `firebase deploy --only hosting` para activar Firebase Hosting que apunta al servicio Cloud Run

---

## Paso 7 — Conectar dominio `mundial2026.club` (una sola vez)

### En Firebase Console:
1. Ir a **Hosting** → tu sitio → **Agregar dominio personalizado**
2. Escribir `mundial2026.club`
3. Firebase te dará dos registros DNS (type `A` o `TXT` para verificación)

### En Namecheap:
1. Entrar a **Domain List** → `mundial2026.club` → **Manage**
2. Ir a **Advanced DNS**
3. Agregar los registros que Firebase te dio:
   - Primero el record `TXT` de verificación
   - Luego los dos registros `A` apuntando a Firebase

4. Esperar propagación DNS: 5 min → 24 hs

> Firebase maneja el certificado SSL/TLS automáticamente.

---

## Paso 8 — Actualizar DB (schema de Google OAuth)

Si es un deploy fresco con DB en Turso:
```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:push
```

Si ya tenés datos y querés aplicar solo la migración de Google OAuth:
```bash
# Aplicar manualmente en turso shell o con drizzle-kit migrate
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:push --force
```

---

## Variables de entorno completas

| Variable | Requerida | Descripción |
|---|:---:|---|
| `TURSO_DATABASE_URL` | ✅ | URL de la base de datos Turso |
| `TURSO_AUTH_TOKEN` | ✅ | Token de autenticación Turso |
| `ORIGIN` | ✅ | URL pública de la app (ej: `https://mundial2026.club`) |
| `SESSION_DURATION_DAYS` | ❌ | Duración sesión en días (default: 30) |
| `GOOGLE_CLIENT_ID` | ❌* | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ❌* | Client Secret de Google OAuth |

*Requeridas si se quiere habilitar login con Google. Si no se proveen, el botón de Google no aparece.

---

## Re-deploys rápidos

Una vez configurado todo, para actualizar la app:
```bash
pnpm deploy:firebase
```

Solo Cloud Run (sin tocar Firebase Hosting):
```bash
pnpm deploy:cloudrun
```

---

## Costos estimados (100–200 visitas/día)

| Servicio | Costo estimado |
|---|---|
| Cloud Run | $3–12 USD/mes |
| Firebase Hosting | Gratis (Spark plan) |
| Turso DB | Gratis (free tier: 500 DBs, 9 GB) |
| **Total** | **~$3–12 USD/mes** |

---

## Troubleshooting

**Error `oauth_state_mismatch`**: Limpiar cookies del browser e intentar de nuevo.

**Error `google_not_configured`**: Falta `GOOGLE_CLIENT_ID` en las variables de entorno del Cloud Run service.

**Dominio no resuelve**: Verificar que los registros DNS en Namecheap son exactamente los que Firebase Console indicó. Puede tardar hasta 24h en propagarse.

**Cloud Run 403**: Verificar que el servicio tiene `--allow-unauthenticated` habilitado.
Forzarlo manualmente:
```bash
gcloud run services add-iam-policy-binding prode-mundial-2026 \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```
