# AI Ideation Cheatsheet

Single static page (`index.html`) served by nginx. No build step, no backend.

## Deploy (Google Cloud Run)

- GCP project ID: `marii-ge`
- Region: `asia-southeast1` (Singapore)
- Service name: `ai-ideation-cheatsheet`
- Access: public (`--allow-unauthenticated`)

```
gcloud config set project marii-ge
gcloud run deploy ai-ideation-cheatsheet --source . --region asia-southeast1 --allow-unauthenticated
```

Run from this folder. `--source .` builds the `Dockerfile` with Cloud Build, so no local image push is needed.

## Container

- `Dockerfile`: `nginx-unprivileged` pinned to the linux/amd64 digest, listens on 8080 (Cloud Run default).
- Local test: `docker build --platform linux/amd64 -t ai-ideation-cheatsheet .` then `docker run --rm -p 8080:8080 ai-ideation-cheatsheet`.
- The digest pin works around a missing-layer error in colima's containerd store when pulling the multi-arch tag. Keep it unless the build works without it.

## Rules for edits

- Keep `index.html` self-contained: no external scripts, fonts or images.
- Keep the page to 4 sections: Notepad, Sample prompt, User stories (3), Fix prompts.
- The template always says "The user uploads [input]". Do not bring back the enters/pastes/uploads option.
- Sample descriptions describe observed symptoms in the data, not just a label.
- Every prompt template ends with a `Do NOT:` block. There is no separate "what not to do" section.
