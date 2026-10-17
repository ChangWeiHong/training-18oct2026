# Awantec hub

One page that lists every deployed Awantec app and gives each a short link.

- `/` lists the apps.
- `/<slug>` redirects to that app, for example `/twin`.

## Add an app

1. Add an entry to `apps.json`: `slug`, `name`, `summary`, `url`.
2. Redeploy:

```bash
gcloud run deploy awantec-hub --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
```

## Run locally

```bash
docker build -t awantec-hub . && docker run --rm -p 8080:8080 awantec-hub
```
