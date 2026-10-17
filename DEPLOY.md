# Deploy

Every app deploys on its own to Google Cloud Run. `--source .` builds the app's `Dockerfile` with Cloud Build, so you don't build or push an image locally. No app needs secrets.

- GCP project ID: `marii-ge`
- Region: `asia-southeast1` (Singapore)
- Access: public (`--allow-unauthenticated`)

## One-time setup

```bash
gcloud auth login
gcloud config set project marii-ge
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

## Apps

| App | Folder | Service name | URL |
|---|---|---|---|
| Hub | `hub` | `awantec-hub` | https://awantec-hub-271836949821.asia-southeast1.run.app |
| AI Ideation Cheatsheet | `training-cheatsheet` | `ai-ideation-cheatsheet` | https://ai-ideation-cheatsheet-271836949821.asia-southeast1.run.app |
| FORGE / Smart Factory Digital Twin | `apps/smart-factory-twin-3d` | `smart-factory-twin` | https://smart-factory-twin-271836949821.asia-southeast1.run.app |
| Automotive Paint Bench | `~/Code/automotive-paint-bench` (other repo) | `automotive-paint-bench` | https://automotive-paint-bench-271836949821.asia-southeast1.run.app |
| Asset Maintenance Priority Triage | `apps/asset-maintenance-priority-triage` | none (hosted on Google AI Studio) | https://air-compressor-argon.ai.studio/ |

## Deploy an app

Run from the app's folder:

```bash
gcloud run deploy <service-name> --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
```

For example, the twin:

```bash
cd apps/smart-factory-twin-3d
gcloud run deploy smart-factory-twin --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
```

Always pass `--project marii-ge`. Without it, gcloud deploys to whatever project is currently selected.

## Register the deploy in the hub

After you deploy a new app, or when an app's URL changes:

1. Add or update its entry in `hub/apps.json`: `slug`, `name`, `summary`, `url`.
2. Redeploy the hub from `hub/`:

   ```bash
   gcloud run deploy awantec-hub --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
   ```

3. Check it: `curl -s https://awantec-hub-271836949821.asia-southeast1.run.app/apps.json` shows the entry.

When you remove an app, remove its entry and redeploy the hub. Details: [`hub/AGENTS.md`](hub/AGENTS.md).

## Test a container locally

```bash
docker build --platform linux/amd64 -t <service-name> .
docker run --rm -p 8080:8080 <service-name>
```

Then open http://localhost:8080. Every container listens on 8080, the Cloud Run default.

## Add a new app

1. Put it in its own folder with a `Dockerfile` that serves on port 8080.
2. Add a row to the Apps table above.
3. Deploy it, then register it in the hub.
