## Verdict: **fix first**

The joint profiles are credible as generic training examples, but tour behavior and demo framing need corrections before presenting to experts.

**Verification:** 119 frontend tests passed. Source review only; backend acceptance tests, browser focus behavior and GPU rendering were not independently verified. No files edited. Paths below are relative to `apps/torque-signature-analyser/`.

## Findings

| Severity | File:line | Issue | Fix |
|---|---|---|---|
| Important | `web/src/App.jsx:141`, `web/src/state.js:98`, `web/src/components/About.jsx:46` | Tour does **not** stop on “any click, drag, key press” as promised. Editing spec chips, changing speed, switching graph mode and using camera controls leave it active. A rundown can change while the user is inspecting or editing. | Cancel Tour on manual interactions across the workbench; explicitly exempt only the action enabling Tour. Add integration coverage for chip editing and camera/graph controls. |
| Important | `web/src/App.jsx:32`, `web/src/components/PlaybackBar.jsx:40`, `web/src/state.js:69` | Switching the system to reduced motion during an active tour only disables its button. Existing `tour` state remains true and `LOOP_END` continues advancing selections. The disabled, pressed button cannot turn it off. | On reduced-motion activation, clear Tour and stop automatic playback. Guard automatic tour advancement as well. Test a live preference change during playback and the final hold. |
| Important | `web/src/components/Toolbar.jsx:30` | The unconditional **“Synthetic demo data”** badge remains when `?upload=1` loads actual user readings. It then makes an unsupported claim about the displayed data’s provenance. | Bind the badge to the successfully displayed result’s source. For uploaded results, show neutral upload provenance; preserve correct wording while results are stale or requests fail. |
| Minor | `web/src/components/Toolbar.jsx:47–49` | “Illustrative spec” appears in the optgroup, but individual option names remain merely “Mixed shift” or “Clean shift.” The collapsed picker does not reliably expose the joint or disclaimer; the full description is available only through `title`. This misses the brief’s explicit pack-name requirement. | Include joint context and “illustrative spec” in each option’s visible text, or provide persistent adjacent text for the selected pack. |
| Minor | `web/src/components/TorqueGraph.jsx:116–126` | Evidence highlighting retriggers whenever an interval is re-entered, including every automatic loop. Thus a CSS animation declared once still produces indefinitely recurring pulses, contrary to the requested “without a blinking loop.” | Track intervals highlighted for the current selection and suppress repeat pulses across automatic restarts; reset on a deliberate new selection. |

## Expert-credibility notes

- Targets of **140 / 160 / 50 / 55 Nm** and bolt counts **2 / 4 / 1 / 3** are plausible illustrative choices. They cannot establish suitability without bolt grade, friction, engagement, materials and tightening strategy.
- M10 seat-belt anchorage is not inherently wrong. Avoid presenting it as universal: [SCHROTH’s installation guidance](https://www.schroth.com/en/racing/service/installation-instructions/?cid=308&file=files%2Fdefault%2Fpdf%2Fracing%2Finstallation-instructions%2Fracing-belts%2Fea_8-2-quick_guide_online_2025-04.pdf) distinguishes M10 and 7/16-inch hardware.
- Fault populations are deliberately enriched: caliper **14/60**, seat-belt **10/40**, engine mount **12/90**. Label them as training challenge mixes so experts do not interpret them as representative production rates.
- “Operator issues” and washer-stock causation deserve softer wording. These are seeded scenarios; curve shape alone does not establish cause. [Atlas Copco](https://www.atlascopco.com/content/dam/atlas-copco/industrial-technique/mvi/documents/PF6000_Pocket%20Guide%209833864801_L.pdf) explains that missing components change torque rate without prescribing one universal signature.
- The shared flange is an abstract visualization, not caliper/subframe/mount geometry. Say so visibly; the existing motion disclaimer covers travel and compression only.
- Earlier modal-key isolation, uncertainty wording and separated reference bands remain present. No regression found there; this diff does not resolve checkpoint 4’s outstanding deployment-hardening findings.

---

## Outcomes (Claude controller, 2026-10-17)

Codex said checkpoint 4's deployment hardening is unresolved. It is resolved: the fixes merged in PR #2 before this branch existed. They are outside this diff, and Codex reviewed only the diff.

| Finding | Outcome |
|---|---|
| Tour not cancelled by spec edits, speed, graph mode, camera controls, Play | **Fix**: a single `USER_ACTION` turns Tour off. It is dispatched by every manual control except the Tour toggle itself. |
| Reduced motion switched on mid-tour | **Fix**: clear Tour and stop autoplay on the change. Guard `LOOP_END` too. |
| Badge claims synthetic for uploaded data | **Fix**: the badge follows the source of the displayed result. Uploads show "Your upload". |
| Option names lack joint and disclaimer | **Fix**: visible text "Brake caliper · Mixed shift", plus a persistent "Illustrative spec, not an OEM value" line next to the picker |
| Evidence strip pulses on every loop | **Fix**: pulse once per selection |
| Enriched fault rates | **Fix**: descriptions say "training challenge mix, not a production rate" |
| "Operator issues" / washer-stock causation | **Fix**: reword as seeded scenarios ("seeded rehit and double-hit traces") |
| Shared flange is abstract | **Fix**: caption "Generic flange for all joints, not real part geometry." |
| Reviewer: recall partly structural (rescaled wheel-hub shapes); reference RNG re-keyed after seeing held-out numbers | **Disclosed** in README limits |
| Reviewer: 375 px ledger | **No change**: the ledger scrolls inside its own container by design; the page doesn't scroll sideways |
