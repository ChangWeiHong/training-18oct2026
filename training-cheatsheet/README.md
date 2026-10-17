# AI Ideation Cheatsheet

A one-page worksheet for a training session. You write one user story card, the page turns it into a RACE build prompt (Role, Action, Context, Expectation), and you paste it into your AI tool. It follows slides 43–52 of the *AI Ideation & Prototyping* deck (v2.1). The worked example is the deck's robot arm maintenance viewer: six three.js robot arms whose maintenance records come from the trainer's CSV files.

The page is one self-contained `index.html`: no build step, no backend, no external scripts or fonts.

![Story card fields grouped by RACE letter, with the robot arm example filled in](docs/screenshots/notepad.png)

## Run it

Open `index.html` in a browser. To serve it:

```bash
python3 -m http.server 8080
```

## The four sections

1. **Story card to RACE prompt.** The fields are grouped by letter: As a → Role, I want to → Action, So that + Given + layout → Context, Done when + review step → Expectation. The RACE prompt and the story card on the right update as you type. Empty fields stay as `[brackets]`, and the R A C E badges stay dashed until each letter has an answer ("check before you build").
2. **Sample prompt.** The live demo prompt from slide 52: the three.js robot arm viewer that loads the model from a link and works on the trainer's CSV files. Click to copy.
3. **User stories.** The four story cards from slide 29 (As a / Given / Done when). The click story uses the slide 30 checks. "Turn into prompt" loads a card into step 1; copy one or all three.
4. **Fix prompts.** Five one-change follow-ups (including "what I see vs expected"), plus the slide's Do / Avoid golden rules.

![Robot arm live demo prompt](docs/screenshots/sample-prompt.png)

![User stories and fix prompts](docs/screenshots/stories-and-fixes.png)

The template follows slide 47: the data is provided, so the prompt says "do not generate sample data".

The template ends with a `Do NOT:` block. It keeps the generated app small: no login or backend, no invented values, no generated stand-in for the model, no extra features, no libraries besides three.js.

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
