## Verdict

**Needs revision before checkpoint approval.** Cursor-driven rotation and R15 bounds are implemented, but fallback, camera fitting, and inspection accessibility have important gaps. No Critical findings.

## Findings

Paths relative to `apps/torque-signature-analyser/web/`.

| Severity | File:line | Issue | Suggested fix |
|---|---|---|---|
| Important | `src/scene/JointScene.jsx:33`, `src/App.jsx:131` | WebGL detection accepts WebGL1, but installed Three r170 requires WebGL2. Renderer initialization failure has no scene error boundary; Suspense handles loading, not errors. The promised fallback therefore does not reliably preserve the workbench. | Require WebGL2 and isolate renderer/lazy-loading errors behind a boundary that displays the fallback while retaining graph, evidence, and ledger. |
| Important | `src/scene/camera.js:22`, `tests/camera.test.js:11` | Flange presets ignore aspect ratio. Projection reproduction at aspect 0.6 places a flange edge at normalized x = −2.53, well outside the viewport. Tests cover section framing only. The desktop flange screenshot also clips the assembly. | Fit flange bounds using horizontal and vertical FOV; test both presets, selected and overflow states, across phone and desktop aspects. |
| Important | `src/scene/CameraRig.jsx:57`, `src/scene/JointScene.jsx:180` | Presets and sibling chips are keyboard accessible, but orbit and zoom have no keyboard equivalent or focusable inspection surface. Keyboard users cannot inspect beyond the two presets. | Provide labelled keyboard-accessible rotate/zoom/reset controls, scoped so inspection keys never scrub the graph. |
| Important | `src/scene/JointScene.jsx:91–110` | In flange view, sibling bolts show their final angles, seated, while the selected bolt shows the cursor sample. Nothing explains this mixed temporal state. An engineer could interpret it as an assembly-wide snapshot or tightening sequence. | Explicitly label siblings as final-state context and the selected bolt as cursor-driven. |
| Minor | `src/scene/materials.js:24`, `src/scene/Bolt.jsx:8`, `src/scene/Flange.jsx:8` | Resource ownership is incomplete: module-cached textures have no disposal path, while cached geometry relies on implicit reconciler lifecycle. Material cleanup alone does not release textures. This is bounded caching, not evidence of an unbounded leak, but remount behavior is unverified. | Define cache ownership and teardown; verify GPU geometry/texture counts stabilize through preset, selection, and mount cycles. |
| Minor | `src/scene/materials.js:95–103`, `src/scene/JointScene.jsx:78–86` | All four screenshots show useful structured reflections, but broad mottling dominates the plates, highlights clip around washer/head edges, and contact depth is weak. The finish reads more like marbled metal than distinct brushed steel and cast flange. | Reduce roughness-map contrast, tune exposure/cards, and add restrained contact shading; verify close-up and flange views together. |

## What improved since checkpoint 1

The placeholder is now a procedural joint with shared sample-index wiring (`src/App.jsx:132`), measured-angle rotation, null-snug rotation-only behavior, deterministic sibling mapping, and overflow warnings. R15’s approximately 30% starting gap and 10% compression cap are present (`src/scene/JointScene.jsx:13–14`), with a persistent illustrative-motion caption.

Status precedence is correct; chips, selected-status labels, and legend provide non-colour cues. Demand rendering, one-shot environment capture, DPR cap 2, compact-screen LOD, reduced-motion preset snapping, and timer/listener cleanup are sensible. Orbit has no cursor callback; mesh selection rejects drags over its threshold.

## Risks

All **25 kinematics/camera tests passed**. They verify pure calculations, not actual mesh rotation, pointer isolation, keyboard inspection, renderer failures, GPU allocation stability, or rendered camera fitting.

The screenshot review establishes visual appearance only. Runtime frame cost and bundle size were not measured. Lazy loading splits the scene, but immediately mounting it starts loading at app startup (`src/App.jsx:7`, `:132`). Checkpoint 1’s analysis and stale-result findings remain outside this review; their resolution is not established here.
---

## Outcomes (Claude controller, 2026-10-17)

| # | Finding | Outcome | Where |
|---|---|---|---|
| 1 | WebGL1 accepted; no error boundary | **Fix**: require WebGL2; error boundary around the lazy scene shows the fallback text | Task 8c |
| 2 | Flange preset ignores aspect; clips at narrow widths | **Fix**: fit flange bounds with horizontal and vertical FOV; extend camera tests to both presets × phone/desktop aspects | Task 8c |
| 3 | No keyboard orbit/zoom | **Fix**: labelled Rotate left/right, Zoom in/out, Reset view buttons; keys scoped to the 3D panel, never scrub | Task 8c |
| 4 | Siblings final-state vs selected cursor-state unexplained | **Fix**: caption "Other bolts: final state. Selected bolt: at the cursor." | Task 8c |
| 5 | Texture cache has no teardown | **Deferred**: bounded module cache (3 textures), not a leak; recorded for final review | Ledger |
| 6 | Mottled plates, clipped highlights | **Fix (light)**: lower roughness-map contrast, small exposure tune; no new lighting rig | Task 8c |
