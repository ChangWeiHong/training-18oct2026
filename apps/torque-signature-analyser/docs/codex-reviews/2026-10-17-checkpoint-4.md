## Verdict

**Ship with fixes** — checkpoint-3 logic fixes are present, but public-upload availability and 1 GiB resource readiness need work before deployment.

Paths below are relative to `apps/torque-signature-analyser/`. No files edited; requested exclusions respected. Frontend: **87 passed**. Backend: **100 passed, 10 failed, 2 errors**; failures/errors encountered unavailable temporary-file storage in this read-only environment. Container and GPU rendering were not verified.

## Checkpoint 3 follow-up

| Item | Status | Evidence |
|---|---|---|
| New #1: candidate overlap denominator | **Fixed** | `api/analysis.py:206–217` measures the full span. `:312–326` implements the controller-approved exception: unsupported tails become investigate with rotation evidence. |
| New #2: misleading no-snug exclusion | **Fixed** | `api/analysis.py:153` filters before statistics, envelope and IF fitting (`:157–172`); warning at `:398` is now accurate. |
| New #3: interpretation limits/diagram | **Fixed** | `web/src/components/About.jsx:29–40` covers assumed-good references, batch shifts, statistical similarity and continuous-drive scope. `web/src/diagram/how-it-works.svg.txt:2,40,43` includes uncertainty states. |
| New #4: modal arrow-key leakage | **Fixed** | `web/src/usePlayback.js:13` suspends stepping whenever a dialog is open. |
| Partly: insufficient reference support | **Fixed** | `api/analysis.py:297–315` combines minimum usable-reference and corrected overlap checks. |
| Partly: receive-time upload enforcement | **Fixed** | `api/main.py:61–80` counts received bytes independently of Content-Length; `:128` retains per-file bounded reads. |
| Partly: keyboard elevation | **Fixed** | `web/src/scene/Overlay.jsx:53–54` adds buttons; `camera.js:65–66` maps W/S; `CameraRig.jsx:51–52` changes elevation. |
| Partly: mottling/clipped highlights | **Partly** | `web/src/scene/materials.js:105–106` reduces metallic brightness and increases roughness. Actual rendered improvement remains unverified; PNGs excluded as requested. |

Texture ownership remains **Deferred-as-stated** (`web/src/scene/materials.js:21–22,90`).

## New findings

| Severity | File:line | Issue | Fix |
|---|---|---|---|
| Important | `api/requirements.txt:1`; `api/main.py:210` | FastAPI 0.115.6 constrains Starlette below 0.42, retaining the multipart spool-rollover blocking vulnerability fixed in 0.47.2. Valid uploads can exceed the spool threshold despite the body cap. See [dependency constraint](https://raw.githubusercontent.com/fastapi/fastapi/0.115.6/pyproject.toml) and [maintainer advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73). | Upgrade the compatible FastAPI/Starlette stack and rerun upload tests. |
| Important | `api/parsing.py:69,80` | Byte limits do not bound CSV width before pandas allocation. Duplicate detection also uses quadratic `names.count`; a wide, sub-5 MB malformed header can consume substantial CPU/memory. | Validate header width before pandas; use linear duplicate detection and restrict parsed columns. |
| Important | `api/main.py:227`; `Dockerfile:11,18` | Concurrent requests can each allocate pandas frames, aligned curves, forests and response copies. OMP=1 limits some parallelism, not request concurrency or BLAS threads. The proposed command supplies no explicit concurrency cap; **1 GiB safety is unproven**. | Start with low explicit concurrency, bound analysis admission, set relevant BLAS thread limits, and measure peak container memory under concurrent maximum uploads. |
| Minor | `Dockerfile:9–18`; `.dockerignore:1` | Runtime stays root; shell-form CMD weakens signal forwarding. Ignore rules omit generic secrets/environment files. | Add an unprivileged user, use `exec uvicorn`, and exclude `.env*`, credentials and unrelated local artifacts. |
| Minor | `README.md:41,51,85,88` | Accepted minimum is **−10°**, not −360°. Self-comparison includes the candidate, rather than strictly “the rest.” Deploy example omits memory/CPU settings; a 700 MB JS heap does not establish total build-memory fit. | Correct these statements and reproduce the intended deployment flags. |

The multi-stage Dockerfile has sensible dependency-first layers and copies only API modules, samples and built web assets into runtime. Node/Python tags float; pytest/httpx unnecessarily enter production. `$PORT` expansion works. Scientific imports add cold-start cost; sample loading is lazy and analysis fits models per request.

No permissive CORS is configured, but CORS does not prevent public multipart submissions. Analysis failures return generic messages (`api/main.py:228–231`); CSV errors echo parser details (`api/parsing.py:72`). SPA resolution checks containment (`api/main.py:243–246`), preventing file escape.

README/About clearly distinguish training evidence from quality approval. DESIGN’s contrast and universal framing claims (`DESIGN.md:38,69`) need measured/browser evidence.

## Go/no-go checklist

- Upgrade the affected backend dependency stack.
- Bound CSV width and analysis concurrency.
- Verify cold start and peak memory under 1 GiB/1 CPU.
- Pass the complete backend suite with writable temporary storage.
- Verify real GPU rendering, keyboard tilt and phone/desktop framing.
- Correct README discrepancies; verify DESIGN accessibility claims.
- Smoke-test the built container, alternate PORT and streamed uploads.
- After deployment, register the URL in `hub/apps.json` and redeploy the hub.
---

## Outcomes (Claude controller, 2026-10-17)

Checkpoint 3 follow-up: 7 of 8 fixed, 1 partly (materials; the controller checked them in Chrome on a real GPU: the socket reads as metal and the section is legible, but the flange top is still bright. Logged as a minor).

Backend suite note: Codex's 10 failures / 2 errors came from its read-only sandbox, which has no temp storage. The controller ran it locally: **112 passed**.

| Finding | Outcome |
|---|---|
| Starlette multipart spool advisory | **Fix**: upgrade FastAPI to a release that allows Starlette ≥ 0.47.2; rerun upload tests |
| CSV width / quadratic duplicate check | **Fix**: reject headers over 64 columns before pandas, linear duplicate check, parse only known columns |
| Concurrency vs 1 GiB | **Fix**: analysis admission semaphore (2 at a time; extra requests get a 503 "Server busy" in the standard error shape); BLAS thread env vars; Cloud Run `--concurrency 4`; measure peak container memory with `docker run --memory 1g` under 4 concurrent maximum uploads |
| Root user, shell CMD, .dockerignore, test deps in image | **Fix**: non-root user, `exec` in CMD, ignore `.env*`/credentials, split `requirements-dev.txt` |
| README discrepancies | **Fix**: −10° minimum, "includes the candidate", full deploy flags, plus the Task 10 review items |
| DESIGN contrast/framing claims | **Fix**: cite measured ratios (task 9b report) and the camera projection tests, or soften |
| GPU rendering | **Done by controller** in Chrome (see above) |
| Register in hub after deploy | **Planned** (Task 11) |
