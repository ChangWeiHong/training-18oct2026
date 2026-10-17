## Verdict

**Not ready to ship:** the core analysis is implemented, but incomplete comparisons can produce reassuring results, and malformed uploads can bypass resource limits or return unstructured errors. No answer-key leakage found; code inspection cannot establish whether held-out seeds influenced tuning.

## Findings

Paths below are relative to `apps/torque-signature-analyser/`. Scene work and Tasks 9–11 are excluded.

| Severity | File:line | Issue | Suggested fix |
|---|---|---|---|
| Critical | `api/analysis.py:119` | Pre-snug grid allocation grows with the largest uploaded snug angle, without a bound. A tiny valid CSV with billion-degree angles can exhaust memory despite file/point limits. | Bound grid size independently of angle magnitude; validate supported angle ranges. |
| Important | `api/analysis.py:179` | Missing spec features are skipped, then any successful check permits **“within.”** Reproduced: two samples at 110 Nm return `within` + `cant_assess`, although post-snug angle was never checked. | Report incomplete specification assessment explicitly; require all supplied limits to be assessable before saying “within.” |
| Important | `api/analysis.py:259` | Can't-assess checks only the candidate, not reference sufficiency. Reproduced: a reference with no snug/slope and an entirely null envelope still yields `typical` for a candidate. Coverage also excludes unalignable reference runs (`:115`), making surviving coverage look stronger. | Require usable reference support per comparison; expose excluded reference counts and insufficient overlap. |
| Important | `api/parsing.py:35`, `:65`, `:76` | Infinity passes numeric validation; blank IDs become `"nan"` and merge. Headers colliding after normalization cause an uncaught exception: reproduced plain-text **500**, violating the error contract. | Reject nonfinite numbers, blank IDs and duplicate normalized headers with structured row/column/fix errors. |
| Important | `api/main.py:86` | Uploads are fully read before checking 5 MB; multipart parsing happens earlier still. CSV parsing also runs synchronously in the async endpoint. | Enforce request/upload bounds while receiving; read at most limit+1 bytes and offload parsing. |
| Important | `web/src/components/EvidencePanel.jsx:25` | “No single value outside the reference range” is unproven: IF-only means no robust-z threshold exceeded, whereas displayed ranges are p5–p95. Values can exceed those ranges without exceeding z=4. Area-only copy similarly equates mean deviation from the median with leaving the band. | Say which detector triggered and what it measures; independently check range claims or remove them. |
| Important | `web/src/App.jsx:29`, `:70` | Failed/new analyses leave old results visible beneath newly selected filenames/spec inputs. Uploading a reference while a sample is active displays its filename but does not use it (`:76`). Clearing sample spec silently restores defaults through `web/src/api.js:30`. | Bind visible results to the exact submitted inputs; mark stale results and make reference/spec behavior explicit. |
| Important | `web/src/components/TorqueGraph.jsx:77`, `:257` | Absolute mode overlays the absolute pre-snug envelope with a snug-shifted aligned envelope, including negative relative angles. These are different reference populations/coordinates, creating overlapping, potentially contradictory bands under one legend. Uniform decimation can also hide narrow drops. | Distinguish the bands and restrict their regions; preserve extrema when reducing curves. |
| Minor | `web/src/components/Ledger.jsx:57`, `:79` | The ARIA grid lacks grid keyboard navigation; every row becomes a tab stop, potentially 500 stops. | Use native table semantics with selection buttons, or implement roving focus and grid navigation. |

## What improved vs the design

The bounded pairwise Theil–Sen calculation is deterministic; null envelope gaps, reference-only IF fitting, and request sequencing are implemented clearly. Threshold changes to IF p0.5 and area p99×1.4 are permitted tuning, but need calibration evidence.

**Verification:** 43 analysis/features/parser/acceptance tests and 18 frontend helper tests passed. These were source-level checks and small API reproductions, not browser accessibility verification.

## Risks

1. **Service availability:** unbounded angle-derived allocation and late upload limits.
2. **False reassurance:** incomplete spec checks and inadequate references still produce positive labels.
3. **Misattributed results:** stale output can appear associated with new files or spec values.
4. **Unsupported explanations:** range/band wording overstates what the detectors established.
5. **Synthetic acceptance overconfidence:** `api/tests/test_acceptance.py:28` counts outside-spec as successful recall, so signature detection can fail while acceptance passes. Different seeds exercise the same generator assumptions; they do not validate real traces, sampling variation, reference contamination, or field false-positive rates.
---

## Outcomes (Claude controller, 2026-10-17)

| # | Finding | Outcome | Where |
|---|---|---|---|
| 1 | Unbounded pre-snug grid (analysis.py:119) | **Fix**: cap grid length and reject angles > 3600° with a row/column error | Hardening task (after Task 8) |
| 2 | "within" when angle check skipped | **Fix**: new spec result `incomplete` ("spec partly checked") when a supplied limit can't be assessed | Hardening task + UI label |
| 3 | No reference-sufficiency check | **Fix**: `cant_assess` when the reference has < 20 usable rundowns or the candidate's aligned overlap with covered envelope is < 50 %; warnings report excluded reference runs | Hardening task |
| 4 | inf, blank ids, duplicate headers → 500 | **Fix** (was a deferred minor from the Task 1 review) | Hardening task |
| 5 | Upload size checked after full read | **Fix**: read at most limit+1 bytes, parse in threadpool | Hardening task |
| 6 | IF-only / area-only copy overclaims | **Fix**: name the detector and what it measures, drop the "no single value outside the range" claim | Hardening task (copy in format.js) |
| 7 | Stale results under new inputs; reference upload ignored on packs; cleared spec restores defaults | **Fix** (overlaps rulings R12/R13) | Task 9 |
| 8 | Absolute mode overlaps two envelopes; decimation hides drops | **Fix**: pre band only before snug, post band only after, distinct legend; min/max-preserving decimation | Task 9 |
| 9 | Ledger: every row a tab stop | **Fix**: roving tabindex + Up/Down (ruling R13) | Task 9 |
| Risk 5 | Acceptance counts outside-spec as recall | **Fix**: add signature-only recall test for in-spec seeded rundowns (held-out seeds), tune on seed 7 only | Hardening task |
| — | "Synthetic data doesn't validate real traces" | **Accepted as a limit**: stated in README and About drawer; no real traces available | Task 9/10 copy |
