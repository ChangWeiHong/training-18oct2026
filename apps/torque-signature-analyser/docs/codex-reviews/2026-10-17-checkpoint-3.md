## Verdict

**Needs revision before deploy.** Most fixes are implemented, but reference-support checks and upload enforcement remain incomplete. About acknowledges synthetic-data limits honestly, but omits important interpretation limits.

Paths below are relative to `apps/torque-signature-analyser/`. All 85 frontend helper tests passed; backend tests could not start because the read-only environment prevents temporary-file creation. Screenshots show fallback layouts, so they cannot verify rendered 3D improvements.

## Previous findings

| Checkpoint | # | Finding | Status | Evidence |
|---|---|---|---|---|
| 1 | 1 | Unbounded pre-snug allocation | Fixed | `api/analysis.py:124` caps the grid; `api/parsing.py:107` rejects unsupported angles. |
| 1 | 2 | “Within” despite skipped angle check | Fixed | `api/analysis.py:195` returns `incomplete`; `web/src/components/EvidencePanel.jsx:16` explains it. Outside still takes precedence. |
| 1 | 3 | Insufficient reference can yield typical | Partly fixed | `api/analysis.py:285` requires 20 usable references; `:213` truncates the overlap denominator to reference coverage, defeating the claimed candidate-span check. |
| 1 | 4 | Infinity, blank IDs, duplicate headers | Fixed | `api/parsing.py:43` rejects infinity; `:82` rejects duplicate normalized headers; `:97` rejects blank IDs. |
| 1 | 5 | Upload limits checked too late | Partly fixed | `api/main.py:87` bounds reads; `:96` offloads parsing. However, `:169` parses multipart before those reads; the early guard relies on Content-Length (`:163`). |
| 1 | 6 | IF/area explanations overclaim | Fixed | `web/src/format.js:11` names IF and the z threshold; `:12` describes deviation from the median instead of leaving the band. |
| 1 | 7 | Stale results/reference/spec confusion | Fixed | `web/src/App.jsx:103` computes staleness, `:143` displays it, `:109` explains unused reference uploads. `api/main.py:156` distinguishes omitted spec from explicit null. |
| 1 | 8 | Overlapping bands; hidden drops | Fixed | `web/src/components/TorqueGraph.jsx:73` clips bands around snug; `:243` uses extrema-preserving decimation, implemented in `web/src/graph.js:44`. |
| 1 | 9 | Hundreds of ledger tab stops | Fixed | `web/src/components/Ledger.jsx:48` handles Up/Down/Home/End; `:92` provides one row tab stop. |
| 1 | Risk 5 | Spec failures mask weak signature recall | Fixed | `api/tests/test_acceptance.py:52` separately requires ≥70% signature recall among in-spec seeded abnormalities. This remains aggregate, synthetic evidence. |
| 1 | — | Synthetic tests cannot validate real traces | Deferred-as-stated | `web/src/components/About.jsx:36` discloses synthetic data, tiny in-spec abnormal cohorts, and possible real-trace differences. |
| 2 | 1 | WebGL1 accepted; missing boundary | Fixed | `web/src/scene/webgl.js:4` requires WebGL2; `web/src/App.jsx:168` wraps lazy loading and scene rendering in `SceneBoundary`. |
| 2 | 2 | Flange fitting ignores aspect | Fixed | `web/src/scene/camera.js:33` projects bounds using aspect; `:96` applies fitting. `web/tests/camera.test.js:39` covers narrow/wide, selected/overflow cases. |
| 2 | 3 | No keyboard orbit/zoom | Partly fixed | `web/src/scene/Overlay.jsx:50` supplies labelled controls; `CameraRig.jsx:49` rotates azimuth only. No keyboard elevation control exists despite `camera.js:51` supporting polar movement. |
| 2 | 4 | Mixed sibling/selected temporal state | Fixed | `web/src/scene/Overlay.jsx:44` explicitly distinguishes final-state siblings from cursor-driven selection. |
| 2 | 5 | Cached texture ownership/teardown | Deferred-as-stated | `web/src/scene/materials.js:21` retains module caches; `:90` retains two hatch textures. No teardown or GPU-stability evidence added. |
| 2 | 6 | Mottling/clipped highlights | Partly fixed | `web/src/scene/materials.js:35` reduces texture contrast; `JointScene.jsx:19` lowers exposure. Supplied final screenshots contain no rendered joint, so visual resolution is unverified. |

## New findings

| Severity | File:line | Issue | Fix |
|---|---|---|---|
| Important | `api/analysis.py:213` | New overlap guard reports 100% when reference covers 0–10° and candidate spans 100°: the denominator stops at 10°. Thus “less than 50% candidate overlap → can’t assess” is not implemented. | Measure actual candidate-span support; separately flag excessive rotation so unsupported tails remain visible. |
| Important | `api/analysis.py:367` | Warning says no-snug reference rundowns “were left out,” but `:155` includes their available features in statistics and `:170` includes them, imputed, in IF fitting. Engineers may believe contaminated runs were excluded entirely. | Exclude consistently or specify “excluded from the envelope”; disclose their detector contribution. |
| Important | `web/src/components/About.jsx:29` | “Normal rundowns” and self-comparison wording omit that uploaded references are assumed good, batch-wide shifts can disappear, and “typical” does not establish fastening quality. Continuous-drive-only scope is also absent. Diagram omits can’t-assess/incomplete outcomes. | Add these limits and uncertainty states; explicitly distinguish statistical similarity from quality approval. |
| Minor | `web/src/usePlayback.js:6` | About dialog is absent from key exclusions. Left/Right on its Close button bubbles to the global handler and changes the underlying cursor. | Suspend global stepping while a modal is open or exclude dialog descendants. |

## Risks before deploy

1. Enforce receive-time upload limits independently of Content-Length.
2. Correct reference-support accounting and misleading exclusion warnings.
3. Strengthen About’s quality-interpretation and supported-trace limits.
4. Verify actual WebGL rendering, framing, materials, and keyboard elevation at phone/desktop sizes.
5. Obtain backend test results; synthetic acceptance remains insufficient evidence for real production traces.
---

## Outcomes (Claude controller, 2026-10-17)

Scorecard of earlier findings: 13 fixed, 4 partly fixed, 2 deferred as stated.

| Item | Outcome | Where |
|---|---|---|
| CP1-3 / new #1: overlap denominator stops at reference coverage | **Fix, and reverses controller ruling R16.** Measure overlap over the candidate's full post-snug span. Rotation past the reference becomes its own evidence line ("Runs N° past the reference curve"), and it flags *investigate*, not *can't assess*. That keeps soft joints flagged. | Task 9b |
| CP1-5: receive-time upload limit | **Fix**: ASGI body-size limit counts streamed bytes regardless of Content-Length | Task 9b |
| CP2-3: no keyboard elevation | **Fix**: "Tilt up" / "Tilt down" buttons + W/S keys in the 3D panel | Task 9b |
| CP2-5: texture teardown | **Deferred** (bounded cache), unchanged | — |
| CP2-6 / Risk 4: 3D visuals unverified in final screenshots | **Controller verifies in a real GPU browser before deploy** | Pre-deploy check |
| New #2: "left out" warning wording | **Fix**: exclude no-snug reference runs from statistics and IF too, so the warning is true | Task 9b |
| New #3: About omits interpretation limits | **Fix**: add that the reference is assumed good, that a batch-wide shift can hide, that "typical" is statistical similarity and not a quality approval, that the scope is continuous-drive traces only, and add can't-assess/incomplete to the diagram | Task 9b |
| New #4: arrow keys leak through About dialog | **Fix**: suspend global stepping while a dialog is open | Task 9b |
| Risk 5: backend tests not run by Codex (read-only sandbox) | **Controller runs pytest and attaches output** | Each task report |
