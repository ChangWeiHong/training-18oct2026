# Torque Signature Analyser: design

Date: 2026-10-17 · Folder: `apps/torque-signature-analyser` · Cloud Run service: `torque-signature-analyser` · Hub slug: `torque`
Cross-checked with Codex (gpt) on 2026-10-17; its changes are folded in and marked *(Codex)*.

## Intent

Assembly and quality engineers in training learn to read a bolt's torque-angle signature. They load readings from a fastening tool, compare each rundown with a known-good reference, and see which rundowns look unusual. A 3D joint replays the tightening so they can link the curve to what the bolt did.

Business value: spot fastening problems (cross-thread, soft joint, rehit, stripped thread, early shutoff) before they become assembly failures or rework.

A flag means "worth investigating". It never means "confirmed defect". The UI says this wherever a flag appears.

## Goals

1. Load torque-angle CSV: upload, or pick a built-in sample pack from a dropdown. Download a CSV template.
2. Plot each rundown over the normal envelope built from a known-good reference.
3. Give every rundown two independent results *(Codex)*:
   - **Specification**: within / outside / not supplied (rule-based torque and angle limits)
   - **Signature**: typical / worth investigating / can't assess (statistics + Isolation Forest)
4. Show the evidence for each signature flag as observed differences with the reference range, e.g. "Post-snug rotation 84°. Reference 28–52°.", and highlight that interval on the curve.
5. A 3D bolted joint replays the selected rundown. One shared cursor drives graph, torque readout and 3D.

## Non-goals

- No LLM, no GPU, no accounts, no database, no persistence across sessions.
- No live tool integration. CSV only. First release covers continuous-drive tightening traces only *(Codex)*.
- No claim of real plant telemetry. Built-in data is synthetic and labelled so.
- No clamp-load measurement. 3D compression is labelled "illustrative" *(Codex: friction breaks the torque→clamp link)*.

## Anti-goals (fail even if it works)

- Copy that says "defect detected" or shows a probability-like score.
- Generic SaaS look: gradient hero, card grid, glow everywhere (Hallmark anti-patterns).
- 3D that runs on its own clock, unrelated to the selected rundown's data.
- A model that flags more than 3 % of a clean held-out pack.

## Constraints

- Monorepo conventions: own folder under `apps/`, own `Dockerfile`, deploy per `DEPLOY.md` (project `marii-ge`, region `asia-southeast1`, `--allow-unauthenticated`), then register in `hub/apps.json` and redeploy the hub (rule in `AGENTS.md`).
- One container serves both UI and API (Cloud Run, port `$PORT`, default 8080). Stateless requests.
- Limits: 5 MB file, 500 rundowns, 5 000 points per rundown. Reject with one plain sentence naming the row/column and the fix.
- Warm analysis of a 240-rundown pack < 2 s. Cold start measured separately.

## Stack (my call, matches `apps/smart-factory-twin-3d`)

| Part | Choice |
|---|---|
| Frontend | React 18 + Vite, `three` + `@react-three/fiber` + `@react-three/drei` |
| Graph | Hand-built SVG: envelope band, curves, limits, scrubber, evidence intervals. One component owns axes and interaction so sync stays exact. (Codex suggested Recharts + SVG overlay; I kept pure SVG to avoid two coordinate systems.) |
| Backend | Python 3.12, FastAPI, uvicorn, numpy, pandas, scikit-learn. Analysis runs in a threadpool; set `OMP_NUM_THREADS=1`. |
| Container | Multi-stage Dockerfile: `node:22-alpine` builds `web/dist`, then `python:3.12-slim` runs FastAPI, serving `/api/*` and the static build |
| Tests | `pytest` for parsing, features, scoring, generator; `node --test` for pure frontend helpers (cursor mapping, CSV template) |

Folder layout:

```
apps/torque-signature-analyser/
  Dockerfile  README.md  DESIGN.md  .dockerignore
  api/   main.py  parsing.py  features.py  analysis.py  synth.py  samples/  tests/
  web/   index.html  package.json  vite.config.js  src/
  docs/reference-skills/   (vendored MengTo 3D skills: metal, orbit-inspect, high-poly, retina)
```

## Data

### CSV schema (long format, one row per sample)

| Column | Required | Meaning |
|---|---|---|
| `rundown_id` | yes | One tightening |
| `angle_deg` | yes | Cumulative tool rotation from start, degrees |
| `torque_nm` | yes | Measured torque, Nm |
| `sample_index` | no | Acquisition order. If absent, file order is used |
| `time_ms` | no | Used for playback timing when present |
| `assembly_id` | no | Part the bolts belong to (groups bolts in 3D) |
| `bolt_position` | no | 1..6 on that part |

Rules *(Codex)*: keep acquisition order; allow repeated angles while torque changes; reject an angle that drops by more than 2° (reset) with a row-specific error instead of sorting. Headers are case-insensitive. Without `assembly_id`, each rundown is its own one-bolt assembly.

Tightening spec (sent with the request; each sample pack has defaults): `torque_min_nm`, `torque_max_nm`, `angle_min_deg`, `angle_max_deg` (post-snug), `snug_torque_nm`. Final torque = torque at the last sample before tool-release decay (last local max within the final 3 % of angle).

### Reference

- Each sample pack ships a separate known-good reference CSV (≥ 60 rundowns).
- Upload accepts an optional reference CSV.
- No reference supplied: the app builds one from the upload (two-pass: fit, drop flagged, refit) and shows the banner **"Compared within this upload. A shift across the whole batch won't show."** *(Codex)*

### Built-in sample packs (synthetic, seeded, generated by `api/synth.py`, committed as CSV)

Joint: M12×1.75 wheel-hub flange, 6 bolts per assembly. Spec: 99–121 Nm, 20–60° after snug, snug 30 Nm.

1. **Clean shift**: 40 × 6, all normal with realistic scatter.
2. **Mixed shift**: 40 × 6, about 8 % seeded abnormal across the patterns below.
3. **Gradual drift**: slope falls across the shift (worn washer stock). Shows drift vs one-off spikes.
4. **Hard cases** *(Codex)*: truncated traces, no snug crossing, repeated angles, an ambiguous missing-washer case. Shows "can't assess".

Seeded patterns (teaching hypotheses, not unique fingerprints; the UI says "looks like"):

| Pattern | Synthetic shape |
|---|---|
| Cross-thread | High running torque before snug, irregular early rise, sometimes stops early |
| Missing washer | Seating point shifts, changed post-snug slope. Kept separate from soft joint |
| Soft joint | Shallow post-snug slope, extra rotation to reach torque |
| Hard joint / burr | Steep slope, reaches torque in little angle |
| Rehit | Starts near final torque, tiny angle travelled |
| Double hit | Two loading episodes separated by unloading or a pause |
| Stripped thread | Peak below target, then sustained torque loss as rotation continues |
| Early shutoff | Plausible rise, ends below torque min |

A `seeded_pattern` column holds the answer key. The model never reads it. The UI shows it only with an "Answer key" toggle.

## Analysis

### Features per rundown (`features.py`)

final torque, peak torque, total angle, snug angle (first *sustained* crossing of snug torque: 3 consecutive samples), post-snug angle, running torque (median before snug), elastic slope (Theil-Sen fit from snug to 90 % of peak) + fit residual, max torque drop after peak (magnitude and angle span), count of unloading episodes, envelope deviation area.

A feature that can't be computed (no snug crossing, too few points) is `null` and listed as unavailable. MAD floor = measurement resolution (0.1 Nm or 0.1°) so a near-zero spread doesn't blow up z-scores *(Codex)*.

### Envelope

Resample each reference trace on angle *after snug*, −30° to +90° in 1° steps. Band = 5th–95th percentile per grid point, median curve too. Only compute a grid point where ≥ 70 % of reference traces cover it; never extrapolate short traces. Also return the pre-snug view separately.

### Signature result

1. Robust z per feature against the reference (median / MAD with floor).
2. `IsolationForest(n_estimators=200, random_state=0)` fit on the reference features (novelty mode) when the reference has ≥ 30 complete rundowns; otherwise skipped and the UI says "statistics only".
3. **Worth investigating** if any |robust z| > 4, or envelope deviation area above the reference 99th percentile, or Isolation Forest marks it an outlier at the threshold set on the reference (1st percentile of reference scores).
4. **Can't assess** if snug or slope is unavailable.
5. No numeric score shown to the user. The ledger sorts by an internal rank.

### Evidence

Top 2–3 features by |robust z|, each as "Name: value. Reference range: p5–p95." plus the angle interval to highlight on the graph. Then a "Looks like: soft joint" hint if a rule maps the feature combination to a pattern. When Isolation Forest is the only trigger, say "Unusual combination of features; no single value outside the reference range." Robust z doesn't explain an Isolation Forest decision, so the copy never claims it does *(Codex)*.

### API

- `GET /api/samples` → `[{id, name, description, rundowns, spec, csv_url, reference_url}]`
- `GET /api/samples/{id}.csv`, `GET /api/template.csv`
- `POST /api/analyse` → `{sample_id}` JSON, or multipart `readings` + optional `reference` + optional `spec` JSON
- Response: `{warnings[], reference: {source: "supplied"|"sample"|"within-upload", rundowns}, method: "stats+iforest"|"stats", spec, envelope: {grid, p05, p50, p95, coverage}, rundowns: [{id, assembly_id, bolt_position, spec_result, signature, rank, features, evidence[], pattern_hint, seeded_pattern?, curve: {i[], angle[], torque[], t?[]}}], summary: {counts}}`
- `GET /healthz`
- Errors: 400 `{error, row?, column?, fix}`.

## Screen

Workbench layout, desktop first, works at 320–414 px.

1. **Toolbar**: app name, sample-pack dropdown, Upload readings, Upload reference (optional), spec chips (editable), Template link.
2. **Count strip**: "240 rundowns · 3 outside spec · 9 worth investigating · 2 can't assess", plus the reference banner when within-upload.
3. **Workspace**: graph 55 %, 3D joint 45%. Shared playback bar below both: play/pause, speed, step buttons, sample/angle/torque readout. Evidence panel stays visible beside the graph.
4. **Ledger**: sortable rundown table: assembly, position, spec result, signature, first evidence line. Click selects.
5. **About** drawer: "How the analysis works" diagram (diagram-design), method notes, caveats.

Phone: toolbar, counts, graph, playback, 3D (shorter), evidence, ledger. Stacked.

### Graph

- X = angle; toggle "absolute" / "aligned at snug". Y = torque.
- Reference band shaded, median dashed. Torque limits as two horizontal lines, angle limits as two vertical lines, each labelled *(Codex: no single box)*.
- Selected curve bold in its signature colour; others faint (toggle).
- Evidence intervals shaded on the selected curve.
- Cursor line. Drag on the graph moves the cursor. Hover shows sample, angle, torque.

### Shared cursor *(Codex)*

The cursor is a **sample index**, not an angle, so repeated angles keep order. Graph, readout and 3D all read from it. Playback uses `time_ms` when present, otherwise steps uniformly and labels itself "uniform sample playback". Arrow keys step one sample, Shift+arrow ten. 3D orbit never moves the cursor; only the playback bar, graph drag, and keys do.

### 3D scene

- Procedural geometry, no downloaded models: sectioned flange joint (two plates in half-section cut-away), M12 hex-flange bolt with bevelled head and modelled thread in close-up, washer, nutrunner socket. Wheel-hub flange with 6 holes for context; the other 5 bolts show the same assembly's results.
- At cursor sample: bolt and socket rotate by measured angle. Before snug, the bolt travels by pitch × turns (exaggerated, labelled). After snug, plates show bounded **illustrative** compression scaled by torque. Readout labels: "Rotation: measured. Travel and compression: illustrative."
- Colour on bolt head ring: steel = typical, amber = worth investigating, red = outside spec, grey hatch = can't assess. Each also has a symbol + label in the UI, never colour alone.
- Camera: orbit + inspect, bounded (MengTo orbit-inspect). Presets "Joint section", "Flange". No idle auto-rotate.
- Materials per MengTo metal: zinc-coated bolt, brushed steel washer, cast flange, roughness variation. DPR auto, capped at 2 (MengTo retina). Lower detail on small screens (MengTo high-poly LOD).
- No WebGL: show a static message and keep graph, evidence and ledger fully usable.

## Design system

- Follow `apps/smart-factory-twin-3d/DESIGN.md` voice: graphite surfaces, aluminium rules, tabular numerals. Sea-glass `#3df5d2` only for playback and motion. Amber for worth investigating; red only for outside spec. Tokens in `web/src/tokens.css`, OKLCH, no inline colours.
- Hallmark: run the skill in the build; workbench macrostructure; no gradient text, italic headings, fake chrome or invented numbers; 8 states for interactive controls; visible `:focus-visible`; `prefers-reduced-motion` (no pulse, playback still works); no horizontal scroll at 320/375/414/768.
- Copy per stop-slop: short, active, no em dashes, no hype.
- diagram-design: the About diagram (CSV → features → reference envelope + Isolation Forest → two results) as inline SVG, reused in README.

## Builder-check decisions (my calls, 2026-10-17)

1. **Thresholds fixed, detector and generator tunable.** The acceptance numbers hold; the builder may tune z cut-off, envelope percentile, IF threshold and the generator's scatter together. Sample references grow to 120 rundowns. A sustained snug crossing may start at sample 0 (rehit), so rehit gets features, not "can't assess".
2. **Counting.** Clean-pack false-flag rate = rundowns that are within spec AND "worth investigating" / all rundowns. A seeded rundown counts as recalled if it is "outside spec" OR "worth investigating". "Can't assess" counts as recalled only in the hard-cases pack. Early shutoff is expected to be caught by spec.
3. **No snug.** Aligned view hides that rundown and shows "No snug point: shown in absolute view only". Evidence intervals for null features are omitted. 3D skips the travel phase and only rotates.
4. **Upload without spec.** Spec chips start empty and spec result reads "not supplied". A "Use sample spec (M12)" button fills them. Sample packs load with their spec.
5. **3D bolt mapping.** Show only bolts that exist on the 6-hole flange; empty holes stay empty. Missing or out-of-range `bolt_position`: assign by order within the assembly, up to 6. Extra or duplicate rundowns stay selectable in the ledger, not drawn, with a warning.
6. **Cloud Run sizing.** `--memory 1Gi --cpu 1`, min-instances 0 (no idle cost). Cold start target < 15 s, informational only.
7. **Answer key on uploads.** Optional `seeded_pattern` column added to the schema and template. The toggle appears whenever it is present.
8. **MengTo skills are binding** for the points this spec names (metal look, bounded orbit-inspect, DPR cap 2, LOD on small screens). Read all four before building the scene.

## Left to the builder

- Exact exaggeration factors, thread geometry method, token values within the direction above.
- Pattern-hint rules, as long as acceptance tests pass.
- Component breakdown.

## Acceptance *(Codex: held-out seeds, per-pattern)*

- `pytest` passes. Generator tests run on 3 held-out seeds not used for tuning:
  - Clean pack: ≤ 3 % worth investigating.
  - Mixed pack: each pattern recalled ≥ 70 %, overall ≥ 80 %.
  - Hard-cases pack: every truncated / no-snug trace returns "can't assess", not a crash.
- Parser tests: angle reset rejected with row number; repeated angles kept in order.
- `npm run build` passes; Docker image builds and runs on 8080; warm analyse of mixed pack < 2 s.
- All four packs load; uploading a pack's CSV with its reference gives the same results.
- Cursor: graph drag moves 3D; playback moves both; ledger click selects both; orbit doesn't scrub.
- Checked at 1440 and 375 px, with reduced motion, and with WebGL disabled.
- Deployed to Cloud Run, `DEPLOY.md` table updated, `hub/apps.json` entry (slug `torque`), hub redeployed and `curl` check passes.
