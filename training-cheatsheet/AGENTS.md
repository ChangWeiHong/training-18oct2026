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
- Keep the page to 4 sections: Story card to RACE prompt, Sample prompt, User stories (4), Fix prompts.
- The only use case is the deck's robot arm maintenance viewer (v2.1). The compressor example was removed when the deck dropped it.
- Step 2 is `ROBOT_ARM`, the slide 52 live demo prompt pasted as written. Keep it word for word in step with the deck. It has no `Do NOT:` block.
- Step 1's `EXAMPLE` is the click story (slides 29–30). Step 3's `STORIES` are the four slide 29 cards. The model URL lives in `MODEL`.
- The page follows slides 43–52 of the *AI Ideation & Prototyping* deck (Module 04 · Prompting). Keep its words: Role, Action, Context, Expectation (RACE); story card lines As a, I want to, So that, Given, Done when; the slide colours R blue, A red, C yellow, E green.
- One story card fills one RACE prompt: As a = R, I want to = A, So that + Given = C, Done when + Definition of Done = E. `buildPrompt()` is the only prompt builder for step 1.
- The template follows slide 47: the trainer provides the data files, so it says "do not generate sample data". There is no built-in samples dropdown.
- The step 1 template ends with a `Do NOT:` block. There is no separate "what not to do" section.
