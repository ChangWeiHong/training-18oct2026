# Torque Signature Analyser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/torque-signature-analyser`: upload or pick torque-angle readings, compare each rundown with a known-good reference (robust stats + Isolation Forest), and replay the selected rundown on a synced graph and 3D bolted joint.

**Architecture:** FastAPI (Python 3.12) does parsing, features, envelope and scoring, and serves the built React app. React 18 + Vite + react-three-fiber renders the workbench: a hand-built SVG graph, a procedural 3D joint, and a ledger, all driven by one shared cursor (sample index). One multi-stage Docker image deploys to Cloud Run.

**Tech Stack:** Python 3.12, fastapi, uvicorn, numpy, pandas, scikit-learn, pytest, httpx · Node 22, React 18.3, Vite 6, three 0.170, @react-three/fiber 8, @react-three/drei 9, lucide-react

**Spec:** `docs/superpowers/specs/2026-10-17-torque-signature-analyser-design.md` (read it in full before Task 1; section "Builder-check decisions" overrides anything earlier).

## Global Constraints

- App root: `apps/torque-signature-analyser`. Python in `api/`, frontend in `web/`. All paths below are relative to the app root.
- No LLM, no GPU, no database, no accounts. Stateless requests.
- Limits: 5 MB file, 500 rundowns, 5 000 points per rundown.
- Never show a numeric anomaly score or the word "defect" in the UI. Signature labels exactly: `typical`, `worth investigating`, `can't assess`. Spec labels: `within spec`, `outside spec`, `not supplied`.
- Within-upload banner text exactly: "Compared within this upload. A shift across the whole batch won't show."
- 3D readout text exactly: "Rotation: measured. Travel and compression: illustrative."
- No-snug note exactly: "No snug point: shown in absolute view only"
- Sample spec (M12×1.75): torque 99–121 Nm, post-snug angle 20–60°, snug 30 Nm.
- Colours: tokens only (`web/src/tokens.css`, OKLCH). Sea-glass `#3df5d2` only for playback and motion; amber = worth investigating; red = outside spec only; steel = typical; grey hatch = can't assess. Never colour alone: each status has a symbol + label.
- Copy follows stop-slop: short, active voice, no em dashes, no hype.
- Hallmark: load the `hallmark` skill before Task 6 (go-ahead inferences: audience = assembly/quality engineers in training; use = find rundowns worth checking; tone = technical workbench). No gradient text, no italic headings, no fake chrome, 8 states on controls, `:focus-visible` ring, `prefers-reduced-motion`, no horizontal scroll at 320/375/414/768.
- 3D: read all four `docs/reference-skills/mengto-*.md` before Task 8. DPR capped at 2, bounded orbit, no auto-rotate.
- Deploy: project `marii-ge`, region `asia-southeast1`, service `torque-signature-analyser`, `--memory 1Gi --cpu 1 --allow-unauthenticated`, min-instances 0.

## Review Focus

1. A real-tool CSV with extra columns, `;` separators, or a BOM: expect it parsed (extra columns ignored, `;` sniffed, BOM stripped), or a 400 naming the problem. Test in Task 1.
2. Upload with only 5 rundowns and no reference: expect "statistics only", no crash, banner shown. Test in Task 4.
3. A rundown with constant torque (MAD 0 in reference for some feature): expect the floor to keep z finite. Test in Task 4.
4. Switching sample packs while playback runs: expect playback to stop and cursor to reset to 0, with no stale selection id. Test in Task 6 (`selectionReducer`).
5. Phone width 375 px with WebGL unavailable: expect graph, evidence and ledger usable and the 3D slot showing a message. Checked in Task 9.

---

### Task 1: API scaffold and CSV parsing

**Files:**
- Create: `api/requirements.txt`, `api/__init__.py`, `api/parsing.py`, `api/tests/test_parsing.py`, `api/tests/conftest.py`

**Interfaces:**
- Produces:
  - `class ParseError(Exception)` with attributes `message: str, row: int | None, column: str | None, fix: str`
  - `parse_readings(data: bytes) -> pandas.DataFrame` with columns `rundown_id:str, i:int (0-based order within rundown), angle_deg:float, torque_nm:float, time_ms:float|NaN, assembly_id:str, bolt_position:int|NaN, seeded_pattern:str|NaN`, sorted by `rundown_id` then `i`
  - Constants `MAX_BYTES=5_000_000, MAX_RUNDOWNS=500, MAX_POINTS=5000`

- [ ] **Step 1: Create `api/requirements.txt`** with pinned `fastapi==0.115.6 uvicorn[standard]==0.34.0 numpy==2.2.1 pandas==2.2.3 scikit-learn==1.6.0 python-multipart==0.0.20 pytest==8.3.4 httpx==0.28.1`. Create a venv `api/.venv` and install. Add `api/.venv/` to the repo `.gitignore`.
- [ ] **Step 2: Write failing tests** in `test_parsing.py`:
  - `test_minimal_columns`: 2 rundowns, required columns only → 2 unique ids, `assembly_id == rundown_id`, `i` is 0..n-1.
  - `test_headers_case_insensitive_and_bom`: header `﻿Rundown_ID,Angle_Deg,Torque_Nm` parses.
  - `test_semicolon_separator`: `;`-separated file parses.
  - `test_extra_columns_ignored`.
  - `test_sample_index_orders_rows`: rows shuffled in file, `sample_index` restores order.
  - `test_repeated_angles_kept_in_order`: angles `[0,1,1,1,2]` with torques `[0,1,2,3,4]` → torque order preserved.
  - `test_angle_reset_rejected`: angle drops 10° at file row 5 → `ParseError` with `row == 5` and `column == "angle_deg"`.
  - `test_missing_required_column`: no `torque_nm` → `ParseError(column="torque_nm")`.
  - `test_too_many_rundowns`: 501 ids → `ParseError` whose message contains "500".
  - `test_non_numeric_torque`: "abc" at row 3 → `ParseError(row=3)`.
- [ ] **Step 3: Run** `cd api && .venv/bin/pytest tests/test_parsing.py -q`. Expected: FAIL (import error).
- [ ] **Step 4: Implement `parse_readings`.** Use `csv.Sniffer` on the first 4 KB for `,`/`;`, `pandas.read_csv`, lower-case and strip headers. "Row" numbers are 1-based data rows (header excluded). Reset rule: within a rundown, `angle[k] < angle[k-1] - 2.0` is an error.
- [ ] **Step 5: Run tests.** Expected: all pass.
- [ ] **Step 6: Commit** `feat(torque): API scaffold and CSV parsing`.

### Task 2: Synthetic generator and sample packs

**Files:**
- Create: `api/synth.py`, `api/samples/` (generated CSVs + `packs.json`), `api/tests/test_synth.py`

**Interfaces:**
- Consumes: `parse_readings`
- Produces:
  - `SAMPLE_SPEC = {"torque_min_nm": 99, "torque_max_nm": 121, "angle_min_deg": 20, "angle_max_deg": 60, "snug_torque_nm": 30}`
  - `PATTERNS = ["cross_thread", "missing_washer", "soft_joint", "hard_joint", "rehit", "double_hit", "stripped_thread", "early_shutoff"]`
  - `make_rundown(rng: numpy.random.Generator, pattern: str | None) -> tuple[numpy.ndarray, numpy.ndarray]` returning (angle_deg, torque_nm)
  - `make_pack(pack_id: Literal["clean","mixed","drift","hard"], seed: int) -> pandas.DataFrame` in the parsed schema plus `seeded_pattern` (`"normal"` for good runs)
  - `make_reference(seed: int, n: int = 120) -> pandas.DataFrame`
  - `write_samples(out_dir: Path) -> None` writes `<pack>.csv`, `<pack>-reference.csv` for each pack with seed 7, plus `packs.json` = `[{id, name, description, rundowns, spec}]`
  - Held-out seeds for acceptance: `HELDOUT_SEEDS = (101, 202, 303)`; generator tuning must use seed 7 only.

- [ ] **Step 1: Write failing tests:**
  - `test_normal_rundown_shape`: 50 normal rundowns → final torque in 99–121, post-snug angle in 20–60, running torque < 10 Nm.
  - `test_each_pattern_distinct` (parametrised over `PATTERNS`): the pattern's defining property holds vs normal median, e.g. soft_joint post-snug angle > 70; hard_joint < 18; early_shutoff final < 99; stripped_thread peak − final > 8 Nm; rehit total angle < 15; cross_thread running torque > 15; double_hit has ≥ 2 unloading episodes (torque drop > 20 Nm then rise); missing_washer snug angle shifted > 25° from normal median.
  - `test_pack_sizes`: clean/mixed/drift = 240 rundowns (40 assemblies × 6 positions); mixed has 15–25 non-normal; hard has ≥ 12 rundowns including truncated (ends below snug) and repeated-angle traces.
  - `test_written_csv_round_trips`: `write_samples(tmp)` then `parse_readings` on each file succeeds.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Normal rundown model: rundown phase 0..θs with running torque 2–6 Nm + noise, seating knee, then elastic slope ~2.2 Nm/° (σ 0.15) until target ~110 Nm (σ 2.5), 0.5° sample spacing, Gaussian noise 0.3 Nm. Drift pack: slope falls linearly 2.2 → 1.4 across assemblies. Each pattern modifies these parameters per the spec table.
- [ ] **Step 4: Run tests; generate samples** with `python -m api.synth` (add `if __name__ == "__main__": write_samples(Path(__file__).parent / "samples")`). Commit CSVs.
- [ ] **Step 5: Commit** `feat(torque): synthetic generator and four sample packs`.

### Task 3: Feature extraction

**Files:**
- Create: `api/features.py`, `api/tests/test_features.py`

**Interfaces:**
- Consumes: `make_rundown`, `SAMPLE_SPEC`
- Produces:
  - `FEATURES = ["final_torque", "peak_torque", "total_angle", "snug_angle", "post_snug_angle", "running_torque", "slope", "slope_residual", "max_drop", "unload_count"]`
  - `snug_index(torque: ndarray, snug_nm: float, sustain: int = 3) -> int | None` (first index where `sustain` consecutive samples ≥ snug; may be 0)
  - `final_index(angle, torque) -> int` (last local max within the final 3 % of angle)
  - `extract(angle: ndarray, torque: ndarray, snug_nm: float) -> dict[str, float | None]` with every key in `FEATURES`; values `None` when not computable
  - `drop_interval(angle, torque) -> tuple[float, float] | None` (angle span of the largest post-peak drop)

- [ ] **Step 1: Failing tests:**
  - `test_snug_index_sustained`: one-sample spike above 30 ignored.
  - `test_snug_at_zero_for_rehit`: rehit trace → `snug_index == 0`, `post_snug_angle < 15`.
  - `test_no_snug_returns_none`: truncated trace → `snug_angle`, `post_snug_angle`, `slope` are `None`; `final_torque` not None.
  - `test_slope_theil_sen_on_normal`: normal trace slope within 2.2 ± 0.5.
  - `test_final_excludes_release_decay`: append 5 samples decaying 110 → 60 at +0.2° each → `final_torque > 105`.
  - `test_unload_count_double_hit` ≥ 2; normal == 0.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement** (slope: `sklearn.linear_model.TheilSenRegressor(random_state=0)` on snug..90 % of peak, residual = RMSE; unload episode = drop > 20 Nm from a running max followed by rise > 20 Nm). **Step 4: Pass.** **Step 5: Commit** `feat(torque): rundown feature extraction`.

### Task 4: Analysis (reference, envelope, results, evidence)

**Files:**
- Create: `api/analysis.py`, `api/tests/test_analysis.py`, `api/tests/test_acceptance.py`

**Interfaces:**
- Consumes: `parse_readings`, `extract`, `snug_index`, `drop_interval`, `FEATURES`, `make_pack`, `make_reference`, `HELDOUT_SEEDS`
- Produces:
  - `analyse(readings: DataFrame, reference: DataFrame | None, spec: dict | None) -> dict` returning exactly the response shape in the spec's API section. Each rundown: `{id, assembly_id, bolt_position, spec_result: "within"|"outside"|"not_supplied", signature: "typical"|"investigate"|"cant_assess", rank: int, features: {name: value|null}, evidence: [{feature, label, value, unit, ref_lo, ref_hi, interval: [a0,a1]|null}], pattern_hint: str|null, iforest_only: bool, seeded_pattern: str|null, curve: {i, angle, torque, t|null}}`
  - `reference.source`: `"supplied"` | `"sample"` | `"within-upload"`; `method`: `"stats+iforest"` | `"stats"`
  - Envelope: `{grid: [-30..90 step 1], p05, p50, p95, coverage}` with `null` where coverage < 0.7; pre-snug envelope under `envelope_pre` on absolute angle 0..max snug angle.

- [ ] **Step 1: Failing unit tests (`test_analysis.py`):**
  - `test_spec_not_supplied` when spec is None → every `spec_result == "not_supplied"`.
  - `test_spec_outside_on_low_final`.
  - `test_mad_floor_keeps_z_finite`: reference with identical `running_torque` → no inf/NaN in response (`json.dumps(..., allow_nan=False)` succeeds).
  - `test_small_upload_stats_only`: 5 rundowns, no reference → `method == "stats"`, `reference.source == "within-upload"`.
  - `test_cant_assess_when_no_snug`.
  - `test_evidence_wording`: soft joint evidence[0].label == "Post-snug rotation" with `ref_lo`/`ref_hi` from the reference p5/p95; `pattern_hint == "soft joint"`.
  - `test_iforest_only_flag_text`: when only IF triggers, `iforest_only is True` and evidence is empty.
  - `test_envelope_coverage_nulls` for grid points with < 70 % coverage.
- [ ] **Step 2: Failing acceptance tests (`test_acceptance.py`)** parametrised over `HELDOUT_SEEDS`, using `make_reference(seed)` as the reference and `SAMPLE_SPEC`:
  - clean pack: count(within spec AND investigate) / total ≤ 0.03
  - mixed pack: per pattern, recalled (outside spec OR investigate) ≥ 0.70; overall ≥ 0.80
  - hard pack: every truncated or no-snug trace → `cant_assess`; no exception
  - timing: `analyse` on mixed pack < 2.0 s (`time.perf_counter`, after one warm-up call)
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement.** Robust z = (x − median) / max(1.4826·MAD, floor) with floor 0.1. Investigate if any |z| > 4 (tunable), or deviation area > reference p99, or IF (`n_estimators=200, random_state=0`, fit on reference features with nulls median-imputed) `score_samples` < reference 1st percentile. IF used only when reference has ≥ 30 complete rundowns. Within-upload reference: fit, drop investigate/outside, refit. Rank: outside spec first, then investigate by max |z| desc, then can't assess, then typical. Pattern hints: rule table over z-signs (e.g. post_snug_angle z > 4 and slope z < −4 → "soft joint"). Tune thresholds on seed 7 only.
- [ ] **Step 5: Run both test files.** Expected: PASS on all held-out seeds.
- [ ] **Step 6: Commit** `feat(torque): reference envelope, two-result scoring, evidence`.

### Task 5: FastAPI app

**Files:**
- Create: `api/main.py`, `api/tests/test_main.py`

**Interfaces:**
- Consumes: `analyse`, `parse_readings`, `ParseError`, `api/samples/packs.json`
- Produces endpoints: `GET /healthz` → `{"ok": true}` · `GET /api/samples` · `GET /api/samples/{id}.csv` · `GET /api/samples/{id}-reference.csv` · `GET /api/template.csv` · `POST /api/analyse` (JSON `{sample_id}` or multipart `readings`, `reference?`, `spec?` JSON string) · static `web/dist` at `/` with SPA fallback (only if the dir exists).

- [ ] **Step 1: Failing tests (TestClient):** healthz; samples list has 4 ids `clean, mixed, drift, hard`; analyse by sample_id returns `reference.source == "sample"`; multipart upload of `mixed.csv` + `mixed-reference.csv` + sample spec gives the same signatures as sample_id; a 6 MB upload → 400 with `fix`; bad CSV → 400 `{error,row,column,fix}`; template.csv header is `rundown_id,sample_index,angle_deg,torque_nm,time_ms,assembly_id,bolt_position,seeded_pattern`.
- [ ] **Step 2: Run, FAIL. Step 3: Implement** (run `analyse` via `starlette.concurrency.run_in_threadpool`; set `OMP_NUM_THREADS=1` in Dockerfile, not code). **Step 4: PASS.** **Step 5: Commit** `feat(torque): FastAPI endpoints`.

### Task 6: Web scaffold, tokens, data flow, ledger

**Files:**
- Create: `web/package.json`, `web/vite.config.js` (dev proxy `/api` → `http://localhost:8080`), `web/index.html`, `web/src/main.jsx`, `web/src/App.jsx`, `web/src/tokens.css`, `web/src/app.css`, `web/src/api.js`, `web/src/state.js`, `web/src/components/Toolbar.jsx`, `web/src/components/CountStrip.jsx`, `web/src/components/Ledger.jsx`, `web/src/components/StatusMark.jsx`, `web/tests/state.test.js`

**Interfaces:**
- Consumes: API response shape from Task 4.
- Produces:
  - `api.js`: `listSamples(): Promise<Sample[]>`, `analyseSample(id): Promise<Result>`, `analyseUpload(readings: File, reference?: File, spec?: Spec): Promise<Result>` (throws `{error,row,column,fix}`)
  - `state.js`: `initialState`, `selectionReducer(state, action)` with actions `LOAD_RESULT {result}`, `SELECT {rundownId}`, `SET_CURSOR {i}`, `STEP {delta}`, `PLAY`, `PAUSE`, `SET_SPEED {x}`; state `{result, selectedId, cursor, playing, speed}`. `LOAD_RESULT` sets `playing=false, cursor=0, selectedId=result.rundowns[0]?.id`. `SET_CURSOR`/`STEP` clamp to `[0, curve.length-1]`.
  - `StatusMark({kind})` renders symbol + label + colour token for the 6 statuses.

- [ ] **Step 1: Load the `hallmark` skill** (inferences in Global Constraints; macrostructure: workbench) and the `stop-slop` skill. Write `tokens.css` first.
- [ ] **Step 2: Failing tests** (`node --test web/tests`): `LOAD_RESULT` resets playing/cursor/selection (Review Focus 4); `STEP` clamps at both ends; `SELECT` resets cursor to 0.
- [ ] **Step 3: Implement** state, api, Toolbar (pack dropdown, Upload readings, Upload reference, editable spec chips starting empty for uploads, "Use sample spec (M12)" button, Template link), CountStrip (counts + exact within-upload banner + "statistics only" note), Ledger (sortable; columns assembly, position, spec, signature, first evidence line; keyboard selectable rows; "Answer key" toggle when any `seeded_pattern` present).
- [ ] **Step 4: Verify:** `npm test` passes; with API running (`uvicorn api.main:app --port 8080`), `npm run dev` loads the mixed pack and the ledger lists 240 rows.
- [ ] **Step 5: Commit** `feat(torque): web scaffold, data flow and ledger`.

### Task 7: Torque-angle graph

**Files:**
- Create: `web/src/components/TorqueGraph.jsx`, `web/src/graph.js`, `web/tests/graph.test.js`, `web/src/components/EvidencePanel.jsx`

**Interfaces:**
- Consumes: `result.envelope`, `result.envelope_pre`, selected rundown, `cursor`, dispatch.
- Produces: `graph.js`: `makeScales(domain, size) -> {x, y, invertX}`, `alignAtSnug(curve, snugAngle) -> curve`, `nearestSampleIndex(curve, angle) -> int` (first index at or after angle, preserving order through repeated angles). `<TorqueGraph result selected cursor mode onCursor />` where `mode` is `"absolute" | "aligned"`.

- [ ] **Step 1: Failing tests:** `nearestSampleIndex` on repeated angles returns the first index; `alignAtSnug` shifts so snug angle → 0; `makeScales.invertX` round-trips.
- [ ] **Step 2: Implement** SVG: band p05–p95 (skip nulls as gaps), dashed p50, torque limit lines and angle limit lines each labelled, faint others toggle, selected curve in status colour, evidence intervals shaded, cursor line, pointer drag → `onCursor(nearestSampleIndex)`, hover tooltip (sample, angle, torque). Aligned mode hides no-snug rundowns and shows the exact no-snug note. EvidencePanel lists evidence lines "Label: value unit. Reference range: lo–hi unit.", the pattern hint as "Looks like: …", the IF-only sentence from the spec, and "Worth investigating, not a confirmed fault." next to any flag.
- [ ] **Step 3: Verify** tests pass; in the browser, dragging on the graph moves the readout.
- [ ] **Step 4: Commit** `feat(torque): synced torque-angle graph and evidence`.

### Task 8: 3D bolted joint

**Files:**
- Create: `web/src/scene/JointScene.jsx`, `web/src/scene/Bolt.jsx`, `web/src/scene/Flange.jsx`, `web/src/scene/materials.js`, `web/src/scene/kinematics.js`, `web/tests/kinematics.test.js`

**Interfaces:**
- Consumes: selected rundown (`curve`, `features.snug_angle`), assembly siblings (same `assembly_id`), `cursor`, `onSelect(rundownId)`.
- Produces: `kinematics.js`: `jointPose(curve, cursor, snugAngle, opts) -> {rotationRad, travel, compression}`, where `rotationRad = angle[cursor]·π/180`; travel = `min(angle, snugAngle)/360 × pitch × exaggeration` (pitch 1.75); compression = `clamp(torque/torque_max, 0, 1) × maxCompression` only after snug, else 0; when `snugAngle` is null, travel = compression = 0. `boltSlots(rundowns) -> Array<{slot: 0..5, rundown}>` per Builder-check decision 5.

- [ ] **Step 1: Read** all four `docs/reference-skills/mengto-*.md`.
- [ ] **Step 2: Failing tests:** `jointPose` rotation equals measured angle; travel stops growing after snug; compression 0 before snug and when snug null; `boltSlots` fills missing positions by order, drops 7th and duplicates (returns them in `overflow`).
- [ ] **Step 3: Implement** scene per spec "3D scene": sectioned plates, hex-flange bolt with bevel + helical thread (close-up LOD only), washer, socket rotating with bolt, flange with 6 holes, status ring colours from tokens, click a sibling bolt → `onSelect`. Camera presets "Joint section" / "Flange", bounded OrbitControls, no auto-rotate, `dpr={[1, 2]}`, lower thread detail when canvas width < 600. Overlay: torque gauge + exact readout text. Orbit never dispatches cursor changes. WebGL check: if unavailable render a plain message box instead of `<Canvas>`.
- [ ] **Step 4: Verify** tests; in the browser, scrubbing rotates the bolt and the gap closes before snug.
- [ ] **Step 5: Commit** `feat(torque): data-driven 3D bolted joint`.

### Task 9: Playback, layout, About diagram, responsive and motion checks

**Files:**
- Create: `web/src/components/PlaybackBar.jsx`, `web/src/components/About.jsx`, `web/src/usePlayback.js`
- Modify: `web/src/App.jsx`, `web/src/app.css`

**Interfaces:**
- Consumes: state + dispatch, selected curve (`t` may be null).
- Produces: `usePlayback(state, dispatch)`: rAF loop; with `t` advances by real time × speed; without, 60 samples/s × speed and the bar shows "uniform sample playback". Arrow keys ±1, Shift+arrow ±10 when focus is not in an input.

- [ ] **Step 1: Implement** PlaybackBar (play/pause, speed 0.25/0.5/1/2/4, step buttons, sample · angle · torque readout in tabular numerals), layout grid (graph 55 % / 3D 45 %, evidence beside graph, ledger below; stacked on phones in the spec order), About drawer with the diagram.
- [ ] **Step 2: Load `diagram-design`** and draw the About diagram as inline SVG: CSV → features → reference envelope + Isolation Forest → Specification result + Signature result. Save a copy as `docs/how-it-works.svg` for the README.
- [ ] **Step 3: Verify in a browser (Playwright MCP):** 1440 px and 375 px screenshots into `docs/screenshots/`; no horizontal scroll at 320/375/414/768 (`document.documentElement.scrollWidth <= innerWidth`); emulate `prefers-reduced-motion: reduce` (no pulse, playback still works); load with WebGL disabled (Review Focus 5); keyboard stepping; ledger click selects both views; orbit drag does not change readout.
- [ ] **Step 4: Run the Hallmark slop test** (Step 7 of the skill) on the UI and fix failures. Run stop-slop quick checks on all visible copy.
- [ ] **Step 5: Commit** `feat(torque): playback, layout, About diagram, responsive checks`.

### Task 10: Container, docs, local run

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`, `DESIGN.md`

- [ ] **Step 1: Dockerfile:** stage 1 `node:22-alpine` → `npm ci && npm run build` in `web/`; stage 2 `python:3.12-slim`, `pip install --no-cache-dir -r api/requirements.txt`, copy `api/` and `web/dist`, `ENV OMP_NUM_THREADS=1 PORT=8080`, `CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}` (shell form so `$PORT` expands). `.dockerignore`: `**/node_modules`, `api/.venv`, `web/dist`, `docs/screenshots`.
- [ ] **Step 2: Verify:** `docker build -t torque . && docker run -p 8080:8080 torque`, then `curl -s localhost:8080/healthz` → `{"ok":true}`; `curl -s -X POST localhost:8080/api/analyse -H 'content-type: application/json' -d '{"sample_id":"mixed"}' | head -c 200` returns JSON; the page loads at `/`.
- [ ] **Step 3: README.md** (stop-slop): what it does, run locally (API + web dev), CSV schema table, the caveat, how-it-works SVG, deploy command. **DESIGN.md**: visual system like the twin's, plus "Source skills reviewed" listing hallmark, diagram-design, stop-slop, MengTo 3D skills.
- [ ] **Step 4: Commit** `feat(torque): container and docs`.

### Task 11: Deploy and register (controller does this, after user confirms)

- [ ] **Step 1:** From the app folder: `gcloud run deploy torque-signature-analyser --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated --memory 1Gi --cpu 1`.
- [ ] **Step 2:** `curl -s <url>/healthz` → ok; open the URL and load the mixed pack.
- [ ] **Step 3:** Add a row to the `DEPLOY.md` table; add `{"slug":"torque","name":"Torque Signature Analyser","summary":"Load torque-angle readings, see which bolt rundowns look unusual against a known-good reference, and replay one in 3D.","url":"<url>"}` to `hub/apps.json`; redeploy the hub per `hub/AGENTS.md`; `curl` check shows the entry.
- [ ] **Step 4: Commit** `docs: register Torque Signature Analyser in hub and DEPLOY.md`.
