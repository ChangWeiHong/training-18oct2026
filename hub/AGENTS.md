# Awantec hub

One static page (`index.html`) plus `apps.json`, served by nginx. No build step. The page lists every app in `apps.json`, and `/<slug>` redirects to that app's URL.

## Rule: every deployed app goes in the hub

Whenever you deploy a new app, or an app's URL changes, in this repo or any other:

1. Add or update its entry in `apps.json`: `slug` (short link, lowercase), `name`, `summary` (one plain sentence on what the user does with it), `url` (the Cloud Run service URL).
2. Redeploy the hub with the command below.
3. Check it: `curl -s https://awantec-hub-271836949821.asia-southeast1.run.app/apps.json` shows the entry.

When you remove an app, remove its entry and redeploy.

## Deploy (Google Cloud Run)

- GCP project ID: `marii-ge`
- Region: `asia-southeast1` (Singapore)
- Service name: `awantec-hub`
- URL: https://awantec-hub-271836949821.asia-southeast1.run.app
- Access: public (`--allow-unauthenticated`)

```
gcloud run deploy awantec-hub --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
```

Run from this folder.

## Rules for edits

- `apps.json` is the only list. Don't hard-code apps in `index.html` or nginx.
- nginx serves `apps.json` with `no-cache`, so changes show on the next page load after deploy.
- Colours and fonts are CSS tokens in `:root`. Use them; don't inline new values.
