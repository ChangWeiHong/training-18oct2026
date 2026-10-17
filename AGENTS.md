# awantec

Training apps, each deployed on its own to Cloud Run in GCP project `marii-ge`, region `asia-southeast1`. Deploy guide for every app: [`DEPLOY.md`](DEPLOY.md). Per-app notes live in each app's folder.

## Rule: register every deploy in the hub

After deploying a new app, or when an app's URL changes, add or update it in `hub/apps.json` and redeploy the hub. This applies to apps from other repos too (for example `~/Code/automotive-paint-bench`). Steps: [`hub/AGENTS.md`](hub/AGENTS.md).
