# AI Ideation Cheatsheet

A one-page worksheet for a training session. You fill in a notepad, the page assembles a build prompt, and you paste it into your AI tool. The worked example is an air compressor health monitor for plant maintenance technicians.

The page is one self-contained `index.html`: no build step, no backend, no external scripts or fonts.

![Notepad with the compressor example filled in](docs/screenshots/notepad.png)

## Run it

Open `index.html` in a browser. To serve it:

```bash
python3 -m http.server 8080
```

## The four sections

1. **Notepad.** Each field maps to one `[bracket]` in the prompt template. The prompt on the right updates as you type, and empty fields stay as `[brackets]` so you can see the gaps. A second pad builds a user story (`As a … I want to … so that …`).
2. **Sample prompt.** A finished prompt for the compressor monitor. Click to copy.
3. **User stories.** Three stories for the same app. Copy one or all three.
4. **Fix prompts.** Four follow-ups for when the first build misses: change one thing, cut scope, fix a wrong claim, show the rules.

![Sample prompt ending in a Do NOT block](docs/screenshots/sample-prompt.png)

![User stories and fix prompts](docs/screenshots/stories-and-fixes.png)

Every prompt asks for fictional sample datasets built into the app, with a dropdown to switch between them. Nobody has to prepare or upload a file to test it.

Every prompt ends with a `Do NOT:` block. It keeps the generated app small: no login, no backend, no charts, no "AI" or "prediction" wording, no invented values for missing data.

## Deploy to Cloud Run

```bash
gcloud config set project marii-ge
gcloud run deploy ai-ideation-cheatsheet --source . --region asia-southeast1 --allow-unauthenticated
```

Run it from this folder. The Dockerfile copies `index.html` into `nginx-unprivileged` on port 8080.

Test the container locally:

```bash
docker build --platform linux/amd64 -t ai-ideation-cheatsheet .
docker run --rm -p 8080:8080 ai-ideation-cheatsheet
```

[`AGENTS.md`](AGENTS.md) holds the edit rules and why the base image is pinned by digest.
