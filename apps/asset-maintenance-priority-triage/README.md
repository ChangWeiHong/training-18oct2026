# Asset Maintenance Priority Triage

A one-screen console for maintenance engineers. You pick a fictional inspection dataset from a dropdown, and the app ranks each machine by how soon it needs work, using fixed rule checks.

All data is fictional. The app makes no AI calls and does not guess missing values. Built in Google AI Studio.

Live: https://air-compressor-argon.ai.studio/

![Dataset dropdown, summary counts and ranked equipment cards](docs/screenshots/overview.png)

## Quick start

```bash
npm install
npm run dev
```

You need Node.js 20+. Vite serves on http://localhost:3000. No API key is needed: `package.json` lists `@google/genai` from the AI Studio template, but the app never calls it.

## What you see

| Part | What it tells you |
|---|---|
| Dataset dropdown | Three samples: complete telemetry, mixed telemetry certainty, and an incomplete field walkdown |
| Summary counts | Assets, Critical (rank 1), Needs Checking, Incomplete |
| Priority cards and table | Each machine's rank (1 to 4), readings, a one-line reason and the rule audit behind it. Switch between cards, table or both |
| Review banner | A maintenance engineer must review the ranking before scheduling downtime or dispatching technicians |

## Rules

`src/utils/rulesEngine.ts` checks four things per machine: vibration velocity (ISO 10816 bands), bearing temperature rise, hours since the last overhaul (8,000 h limit) and lubricant condition. A record with a missing field gets ranked "Incomplete" and lists the missing fields. An unverified lube sample or flagged sensor gets "Needs checking".

Sample data lives in `src/data/sampleDatasets.ts`.

## Hosting

AI Studio hosts this app, not Cloud Run, so the folder has no Dockerfile. The hub links to it at `/triage`.
