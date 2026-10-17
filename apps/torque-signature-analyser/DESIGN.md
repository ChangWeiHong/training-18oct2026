# Torque Signature Analyser Visual System

## Audience and job

Assembly and quality engineers who review bolt tightening curves. The main task is to find the rundowns that differ from their peers, see why, and judge whether to check the joint.

## Visual direction

- Industrial workbench, not a SaaS landing page.
- Graphite surfaces and aluminium rules, defined as OKLCH tokens in `web/src/tokens.css`.
- The torque-angle graph is the visual anchor. A 3D flange sits beside it and follows the graph cursor.
- No decorative gradients, glows or card grids.
- Copy says what a value means and names its limits. It never implies real tool telemetry.

## Layout rules

1. Header with identity and the sample or upload chooser
2. Result summary: counts of typical, investigate, outside spec and not assessable
3. Torque-angle graph with reference band, spec lines and evidence intervals
4. 3D flange and joint section for the selected rundown
5. Evidence panel in plain sentences
6. Ledger of every rundown, one tab stop with arrow-key movement
7. About dialog with the limits

## Colour

| Role | Token | Use |
|---|---|---|
| Surfaces | `--color-paper`, `--color-surface`, `-2`, `-3` | Page, panels, raised controls |
| Rules | `--color-rule`, `--color-rule-strong` | Dividers, axes |
| Control accent | `--color-alu` | Buttons, selection, focus |
| Motion | `--color-motion` (`#3df5d2`) | Playback and moving parts only |
| Amber | `--color-amber` | Investigate |
| Red | `--color-outside` | Outside spec |
| Steel | `--color-steel` | Typical |
| Hatch grey | `--color-hatch` | Not assessable |

Every status carries a symbol and a label next to its colour. Status and body text measure at least 4.5:1 on the surface and raised-surface tokens, including the dimmed stale state. The lowest ratios on the raised surface are faint text at 4.53 and the outside-spec red at 4.67 (task 9b measurements; checked by calculation, not with a screen reader or colour-vision simulation).

## Type and spacing

- UI font stack: Segoe UI, Aptos, Helvetica Neue. Numbers and IDs use the monospace stack.
- Display labels use Arial Narrow.
- Spacing steps follow a 4 pt grid. Radii are 3 px and 5 px.
- Touch targets reach 44 px on coarse pointers.

## 3D contract

- Procedural geometry only: flange plate, one to six evenly spaced bolts (the joint's bolt count), sockets, washer and joint section.
- True perspective camera with orbit, zoom and labelled keyboard controls. Azimuth rotation works from the keyboard.
- Bolt rotation comes from the cursor angle on the graph, not a timer.
- Materials use a brushed-metal look with subdued mottling and lowered exposure.
- The scene needs WebGL2. If it is missing or the renderer fails, a scene boundary shows a fallback and keeps the graph, evidence and ledger working.
- Rendering resolution follows device pixel ratio, capped at 2.

## Motion

- Playback moves the cursor and the bolt. The sea-glass accent marks that motion and nothing else.
- Playback loops: the last pose holds for one second, then the cursor restarts. Tour is opt-in and any user action ends it.
- The selected curve is bold in its status colour up to the cursor and faint and dashed after it. The cursor head turns sea-glass with a halo only while playing. An evidence strip lights once as the cursor enters it.
- Under `prefers-reduced-motion` nothing starts by itself and Tour is disabled. Play and Loop still work and transitions stop.
- While a dialog is open, global keyboard shortcuts pause.

## Source skills reviewed

- hallmark: hierarchy and a workbench layout, with the common generated-UI patterns removed. The graph leads the page, panels sit on a flat grid, and status never relies on colour alone.
- diagram-design: the `docs/how-it-works.svg` pipeline diagram. It uses shared linework, labelled steps and the same graphite palette as the app.
- stop-slop: the microcopy, evidence sentences, About text and this documentation. Copy states the value and its limit in plain words.
- MengTo 3D skills, applied to the flange scene:
  - metal: brushed steel materials with restrained roughness and low-contrast mottling.
  - orbit-inspect: cursor-driven rotation, orbit and zoom controls, and framing that fits both flange presets; the camera projection tests (`web/tests/camera.test.js`) cover narrow and wide aspects with and without a selected bolt. A real-GPU check of every device size is not part of those tests.
  - high-poly: smooth bolt heads, sockets and washers from dense procedural geometry rather than flat primitives.
  - retina: pixel ratio follows the device, capped at 2 to hold frame rate.

The 3D requirement and the graph take precedence over the static-illustration constraints of diagram-design.
