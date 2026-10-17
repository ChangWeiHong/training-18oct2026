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
- Keep the page to 4 sections: Story card to RACE prompt, Sample prompt, User stories (3), Fix prompts.
- The page follows slides 43–48 of the *AI Ideation & Prototyping* deck (Module 04 · Prompting). Keep its words: Role, Action, Context, Expectation (RACE); story card lines As a, I want to, So that, Given, Done when; the slide colours R blue, A red, C yellow, E green.
- One story card fills one RACE prompt: As a = R, I want to = A, So that + Given = C, Done when + Definition of Done = E. `buildPrompt()` is the only prompt builder; the sample prompt is built from `EXAMPLE` with it, so the two cannot drift.
- Deliberate difference from slide 47: the slide says "Do not generate sample data" because trainees get data files. This page asks for built-in fictional samples instead (rule below), matching slide 48's "Use fictional sample data in the prompt".
- The template asks for built-in sample datasets with a dropdown to switch between them, not a file upload. This keeps testing fast. Do not bring back upload, paste or enter options.
- Sample descriptions describe observed symptoms in the data, not just a label.
- Every prompt template ends with a `Do NOT:` block. There is no separate "what not to do" section.
