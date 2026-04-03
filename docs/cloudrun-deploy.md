# Deploy rapido con Cloud Run

Este proyecto usa SvelteKit con adapter-node, asi que necesita backend server.
La opcion mas simple y barata en GCP es usar Cloud Run.

## 1) Requisitos

- Proyecto en Google Cloud (con Billing activa).
- CLI instalada: gcloud.
- Login hecho en gcloud.

Comandos:

```bash
gcloud auth login
gcloud config set project TU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 2) Variables minimas

Necesitas estas variables del entorno:

- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN (opcional si la DB no lo requiere)
- SESSION_DURATION_DAYS (opcional, default 30)
- GCP_PROJECT_ID
- GCP_REGION
- SERVICE_NAME

Forma recomendada para dejarlo listo en tu PC:

```bash
cp .env.cloudrun.example .env.cloudrun
```

Luego editas `.env.cloudrun` con tus valores reales.

## 3) Deploy en un comando

Desde la raiz del repo:

```bash
chmod +x scripts/deploy-cloudrun.sh
pnpm deploy:cloudrun
```

El script:

- Carga automaticamente `.env.cloudrun` si existe
- Hace deploy con `gcloud run deploy --source .`
- Obtiene la URL publica de Cloud Run
- Configura `ORIGIN` con esa URL

Tambien puedes pasar otro archivo de variables si quieres:

```bash
pnpm deploy:cloudrun .env.cloudrun
```

## 4) Costo estimado para tu caso (100-200 visitas/dia)

- Normalmente: 3 a 12 USD/mes
- Con picos moderados: 12 a 25 USD/mes

## 5) Opcional: dominio propio

Despues del deploy, puedes mapear un dominio custom usando Cloud Run domain mappings:
```bash
gcloud beta run domain-mappings create \
  --service TU_SERVICE_NAME \
  --domain tu-dominio.com \
  --region us-central1
```
