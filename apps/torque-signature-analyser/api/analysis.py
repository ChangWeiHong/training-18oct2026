"""Reference, envelope, two independent results (spec, signature) and evidence.

`analyse(readings, reference, spec)` returns a JSON-safe dict (see the design spec,
"API"). Thresholds were tuned on seed 7 only; held-out seeds live in the acceptance tests.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from api.features import FEATURES, drop_interval, extract, final_index, snug_index

GRID = np.arange(-30.0, 91.0, 1.0)
MIN_COVERAGE = 0.7
Z_CUT = 4.0                 # |robust z| above this marks a rundown
MAD_FLOOR = 0.1             # measurement resolution (Nm or deg)
IF_MIN_COMPLETE = 30
IF_PERCENTILE = 0.5         # IF threshold = this percentile of reference scores
AREA_PERCENTILE = 99.0
AREA_MARGIN = 1.4           # multiplier on the reference area p99
DEFAULT_SNUG_NM = 30.0
MAX_PRE_POINTS = 2000       # cap on the pre-snug envelope grid, whatever the angles
MIN_REF_USABLE = 20         # reference rundowns with a snug point and slope
MIN_OVERLAP = 0.5           # share of a candidate's post-snug span the envelope must cover
MIN_REFINE = 5              # within-upload refit needs at least this many kept rundowns
MAX_EVIDENCE = 3
DECIMALS = 3

LABELS = {
    "final_torque": ("Final torque", "Nm"), "peak_torque": ("Peak torque", "Nm"),
    "total_angle": ("Total rotation", "°"), "snug_angle": ("Snug point", "°"),
    "post_snug_angle": ("Post-snug rotation", "°"), "slope": ("Slope after snug", "Nm/°"),
    "running_torque": ("Running torque before snug", "Nm"),
    "slope_residual": ("Slope roughness", "Nm"), "max_drop": ("Torque drop after peak", "Nm"),
    "unload_count": ("Unloading episodes", "count"),
}


@dataclass
class Run:
    id: str
    assembly_id: str | None
    bolt_position: int | None
    seeded_pattern: str | None
    a: np.ndarray
    t: np.ndarray
    time_ms: np.ndarray
    feats: dict
    k: int | None          # snug index
    fi: int                # final index


@dataclass
class Ref:
    n: int = 0
    stats: dict = field(default_factory=dict)      # feature -> (median, scale, p5, p95)
    env: dict = field(default_factory=dict)
    pre: dict = field(default_factory=dict)
    area_p99: float | None = None
    medians: np.ndarray | None = None
    forest: IsolationForest | None = None
    if_threshold: float | None = None
    usable: int = 0                                # rundowns with snug point and slope
    no_snug: int = 0                               # rundowns left out for lack of a snug point


def _opt_str(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else str(v)


def _prep(df: pd.DataFrame, snug_nm: float) -> list[Run]:
    runs = []
    for rid, g in df.groupby("rundown_id", sort=False):
        a = g["angle_deg"].to_numpy(float)
        t = g["torque_nm"].to_numpy(float)
        bolt = g["bolt_position"].iloc[0] if "bolt_position" in g else float("nan")
        runs.append(Run(
            id=str(rid),
            assembly_id=_opt_str(g["assembly_id"].iloc[0]) if "assembly_id" in g else None,
            bolt_position=None if pd.isna(bolt) else int(bolt),
            seeded_pattern=_opt_str(g["seeded_pattern"].iloc[0]) if "seeded_pattern" in g else None,
            a=a, t=t,
            time_ms=g["time_ms"].to_numpy(float) if "time_ms" in g else np.full(len(a), np.nan),
            feats=extract(a, t, snug_nm), k=snug_index(t, snug_nm), fi=final_index(a, t)))
    return runs


# ---------------------------------------------------------------- envelope

def _aligned(r: Run) -> np.ndarray | None:
    """Torque on the snug-aligned grid; NaN where the rundown does not cover it."""
    if r.k is None or r.fi < r.k:
        return None
    acc = np.maximum.accumulate(r.a[:r.fi + 1])
    return np.interp(GRID, acc - acc[r.k], r.t[:r.fi + 1], left=np.nan, right=np.nan)


def _band(mat: np.ndarray, n: int) -> dict:
    """p05/p50/p95/coverage per column; bands are None where coverage < MIN_COVERAGE."""
    cov = (~np.isnan(mat)).sum(0) / max(n, 1)
    out = {"p05": [], "p50": [], "p95": [], "coverage": cov.tolist()}
    for j in range(mat.shape[1]):
        col = mat[:, j]
        col = col[~np.isnan(col)]
        if cov[j] < MIN_COVERAGE or len(col) == 0:
            for key in ("p05", "p50", "p95"):
                out[key].append(None)
        else:
            for key, q in (("p05", 5), ("p50", 50), ("p95", 95)):
                out[key].append(float(np.percentile(col, q)))
    return out


def _envelope(runs: list[Run]) -> tuple[dict, dict]:
    rows = [(r, _aligned(r)) for r in runs]
    rows = [(r, al) for r, al in rows if al is not None]
    mat = np.array([al for _, al in rows]) if rows else np.empty((0, len(GRID)))
    env = {"grid": GRID.tolist(), **_band(mat, len(rows))}
    snug_as = [r.a[r.k] for r, _ in rows]
    top = min(int(math.ceil(max(snug_as))), MAX_PRE_POINTS - 1) if snug_as else 0
    pgrid = np.arange(0.0, top + 1.0)
    pre_rows = []
    for r, _ in rows:
        acc = np.maximum.accumulate(r.a[:r.k + 1])
        pre_rows.append(np.interp(pgrid, acc, r.t[:r.k + 1], left=np.nan, right=np.nan))
    pmat = np.array(pre_rows) if pre_rows else np.empty((0, len(pgrid)))
    return env, {"grid": pgrid.tolist(), **_band(pmat, len(rows))}


def _area(al: np.ndarray | None, p50: np.ndarray) -> float | None:
    if al is None:
        return None
    ok = ~np.isnan(al) & ~np.isnan(p50)
    return float(np.mean(np.abs(al[ok] - p50[ok]))) if ok.any() else None


# ---------------------------------------------------------------- reference fit

def _matrix(runs_feats: list[dict], medians: np.ndarray) -> np.ndarray:
    m = np.array([[np.nan if f[k] is None else f[k] for k in FEATURES] for f in runs_feats], float)
    idx = np.where(np.isnan(m))
    m[idx] = medians[idx[1]]
    return m


def _fit(runs: list[Run]) -> Ref:
    ref = Ref(n=len(runs))
    ref.no_snug = sum(r.k is None for r in runs)
    runs = [r for r in runs if r.k is not None]      # no-snug runs feed nothing below
    ref.usable = sum(r.k is not None and r.feats["slope"] is not None for r in runs)
    cols = {}
    for f in FEATURES:
        vals = np.array([r.feats[f] for r in runs if r.feats[f] is not None], float)
        cols[f] = vals
        if len(vals):
            med = float(np.median(vals))
            mad = float(np.median(np.abs(vals - med)))
            ref.stats[f] = (med, max(1.4826 * mad, MAD_FLOOR),
                            float(np.percentile(vals, 5)), float(np.percentile(vals, 95)))
    ref.env, ref.pre = _envelope(runs)
    p50 = np.array([np.nan if v is None else v for v in ref.env["p50"]], float)
    areas = [x for x in (_area(_aligned(r), p50) for r in runs) if x is not None]
    ref.area_p99 = float(np.percentile(areas, AREA_PERCENTILE)) if areas else None
    complete = [r.feats for r in runs if all(r.feats[k] is not None for k in FEATURES)]
    if len(complete) >= IF_MIN_COMPLETE:
        ref.medians = np.array([np.median(cols[f]) for f in FEATURES], float)
        x = _matrix([r.feats for r in runs], ref.medians)
        ref.forest = IsolationForest(n_estimators=200, random_state=0).fit(x)
        ref.if_threshold = float(np.percentile(ref.forest.score_samples(x), IF_PERCENTILE))
    return ref


# ---------------------------------------------------------------- scoring

def _spec_result(feats: dict, spec: dict | None) -> str:
    """within only when every supplied limit was checked and passed; outside wins."""
    if not spec:
        return "not_supplied"
    checks = [("final_torque", "torque_min_nm", "torque_max_nm"),
              ("post_snug_angle", "angle_min_deg", "angle_max_deg")]
    checked = unassessed = False
    for feat, lo_key, hi_key in checks:
        v, lo, hi = feats[feat], spec.get(lo_key), spec.get(hi_key)
        if lo is None and hi is None:
            continue
        if v is None:
            unassessed = True
            continue
        checked = True
        if (lo is not None and v < lo) or (hi is not None and v > hi):
            return "outside"
    if unassessed:
        return "incomplete"
    return "within" if checked else "not_supplied"


def _covered(r: Run, p50: np.ndarray) -> tuple[int, np.ndarray]:
    """(whole-degree count of the candidate's full post-snug span, envelope coverage of each degree).

    Coverage is only evaluated on the grid; the span itself may be huge, so it is never allocated.
    """
    span = float(np.max(r.a[:r.fi + 1]) - r.a[r.k])
    n = int(min(math.floor(span), 1e12)) + 1
    pts = np.arange(0, min(n, int(GRID[-1]) + 1))
    return n, ~np.isnan(p50[pts - int(GRID[0])])


def _overlap(r: Run, p50: np.ndarray, covered=None) -> float:
    """Share of the candidate's full post-snug span (snug to final angle) that the envelope covers."""
    if r.k is None or r.fi < r.k:
        return 0.0
    n, cov = covered if covered is not None else _covered(r, p50)
    return float(cov.sum() / n)


def _past_reference(r: Run, p50: np.ndarray, covered=None) -> tuple[float, float] | None:
    """(degrees past, last covered absolute angle) when the candidate runs past the reference's end.

    Only when the shortfall is that tail: the span up to the last covered point is itself
    at least MIN_OVERLAP covered. Gaps in the middle give None (can't assess).
    """
    if r.k is None or r.fi < r.k:
        return None
    n, cov = covered if covered is not None else _covered(r, p50)
    if not cov.any():
        return None
    last = int(np.flatnonzero(cov)[-1])
    if last == n - 1 or cov[:last + 1].sum() / (last + 1) < MIN_OVERLAP:
        return None
    return float(n - 1 - last), float(r.a[r.k] + last)


def _zscores(feats: dict, ref: Ref) -> dict:
    return {f: (feats[f] - ref.stats[f][0]) / ref.stats[f][1]
            for f in FEATURES if feats[f] is not None and f in ref.stats}


def _hint(z: dict, feats: dict) -> str | None:
    def hi(f): return z.get(f, 0) > Z_CUT
    def lo(f): return z.get(f, 0) < -Z_CUT
    if hi("running_torque"):
        return "cross-thread"
    if hi("unload_count"):
        return "double hit"
    if lo("snug_angle"):
        return "rehit"
    if hi("snug_angle"):
        return "missing washer"
    if hi("max_drop") and lo("final_torque"):
        return "stripped thread"
    if hi("post_snug_angle") and lo("slope"):
        return "soft joint"
    if hi("slope") and lo("post_snug_angle"):
        return "hard joint"
    if lo("final_torque"):
        return "early shutoff"
    return None


def _interval(feature: str, r: Run) -> list[float] | None:
    f = r.feats
    if feature == "post_snug_angle" and r.k is not None:
        return [float(r.a[r.k]), float(r.a[r.fi])]
    if feature == "running_torque" and f["snug_angle"] is not None:
        return [0.0, float(f["snug_angle"])]
    if feature == "max_drop":
        d = drop_interval(r.a, r.t)
        return [d[0], d[1]] if d else None
    if feature == "slope" and r.k is not None:
        above = np.flatnonzero(r.t[r.k:] >= 0.9 * np.max(r.t))
        end = r.k + int(above[0]) if len(above) else len(r.t) - 1
        return [float(r.a[r.k]), float(r.a[end])]
    return None


def _evidence(r: Run, z: dict, ref: Ref) -> list[dict]:
    flagged = sorted((f for f in z if abs(z[f]) > Z_CUT), key=lambda f: -abs(z[f]))[:MAX_EVIDENCE]
    out = []
    for f in flagged:
        label, unit = LABELS[f]
        out.append({"feature": f, "label": label, "value": r.feats[f], "unit": unit,
                    "ref_lo": ref.stats[f][2], "ref_hi": ref.stats[f][3],
                    "interval": _interval(f, r)})
    return out


def _score(runs: list[Run], ref: Ref, spec: dict | None) -> list[dict]:
    p50 = np.array([np.nan if v is None else v for v in ref.env["p50"]], float)
    if_hit = np.zeros(len(runs), bool)
    if ref.forest is not None and runs:
        x = _matrix([r.feats for r in runs], ref.medians)
        if_hit = ref.forest.score_samples(x) < ref.if_threshold
    ref_ok = ref.usable >= MIN_REF_USABLE
    out = []
    for r, ih in zip(runs, if_hit):
        z = _zscores(r.feats, ref)
        area = _area(_aligned(r), p50)
        z_hit = any(abs(v) > Z_CUT for v in z.values())
        area_hit = area is not None and ref.area_p99 is not None and area > AREA_MARGIN * ref.area_p99
        # A rehit starts above snug (k == 0) and has no fit window, so it is still assessed.
        reason = past = None
        if r.feats["snug_angle"] is None or (r.feats["slope"] is None and r.k != 0):
            reason = "No snug point or slope."
        elif not ref_ok:
            reason = "Reference too small to compare."
        elif _overlap(r, p50, cov := _covered(r, p50)) < MIN_OVERLAP:
            past = _past_reference(r, p50, cov)
            if past is None:
                reason = "Too little overlap with the reference curve."
        cant = reason is not None
        flagged = z_hit or area_hit or bool(ih) or past is not None
        sig = "cant_assess" if cant else "investigate" if flagged else "typical"
        iforest_only = sig == "investigate" and not z_hit and not area_hit and past is None
        evidence = [] if sig != "investigate" or iforest_only else _evidence(r, z, ref)
        if past is not None and sig == "investigate":
            evidence = evidence[:MAX_EVIDENCE - 1]      # the past-reference line counts toward the cap
            evidence.append({
                "feature": "rotation_past_reference", "label": "Rotation past the reference curve",
                "value": past[0], "unit": "°", "ref_lo": 0, "ref_hi": 0,
                "interval": [past[1], float(r.a[r.fi])]})
        out.append({
            "cant_assess_reason": reason, "run": r, "z": z, "spec_result": _spec_result(r.feats, spec), "signature": sig,
            "iforest_only": iforest_only,
            "evidence": evidence,
            "pattern_hint": None if cant else _hint(z, r.feats),
            "max_z": max((abs(v) for v in z.values()), default=0.0)})
    return out


def _rank(items: list[dict]) -> None:
    def key(it):
        group = (0 if it["spec_result"] == "outside" else
                 1 if it["signature"] == "investigate" else
                 2 if it["signature"] == "cant_assess" else 3)
        return group, -it["max_z"]
    for pos, it in enumerate(sorted(items, key=key), start=1):
        it["rank"] = pos


# ---------------------------------------------------------------- response

def _round(v):
    if isinstance(v, dict):
        return {k: _round(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_round(x) for x in v]
    if isinstance(v, (float, np.floating)):
        return round(float(v), DECIMALS) if math.isfinite(v) else None
    if isinstance(v, np.integer):
        return int(v)
    return v


def _rundown_out(it: dict) -> dict:
    r: Run = it["run"]
    t = None if np.isnan(r.time_ms).all() else [None if np.isnan(x) else x for x in r.time_ms]
    return {"id": r.id, "assembly_id": r.assembly_id, "bolt_position": r.bolt_position,
            "spec_result": it["spec_result"], "signature": it["signature"], "rank": it["rank"],
            "features": r.feats, "evidence": it["evidence"], "pattern_hint": it["pattern_hint"],
            "iforest_only": it["iforest_only"], "cant_assess_reason": it["cant_assess_reason"],
            "seeded_pattern": r.seeded_pattern,
            "curve": {"i": list(range(len(r.a))), "angle": r.a.tolist(),
                      "torque": r.t.tolist(), "t": t}}


def analyse(readings: pd.DataFrame, reference: pd.DataFrame | None, spec: dict | None,
            reference_source: str | None = None) -> dict:
    """Score every rundown against the reference (or against the upload itself)."""
    snug_nm = float((spec or {}).get("snug_torque_nm") or DEFAULT_SNUG_NM)
    runs = _prep(readings, snug_nm)
    if reference is not None:
        source = reference_source or "supplied"
        ref = _fit(_prep(reference, snug_nm))
        items = _score(runs, ref, spec)
        no_snug, no_snug_of = ref.no_snug, ref.n
    else:
        source = "within-upload"
        ref = _fit(runs)
        no_snug, no_snug_of = ref.no_snug, ref.n     # counted on the first fit; the refit drops them
        items = _score(runs, ref, spec)
        keep = [it["run"] for it in items
                if it["signature"] == "typical" and it["spec_result"] != "outside"]
        if MIN_REFINE <= len(keep) < len(runs):
            ref = _fit(keep)
            items = _score(runs, ref, spec)
    _rank(items)

    method = "stats+iforest" if ref.forest is not None else "stats"
    n_cant = sum(it["signature"] == "cant_assess" for it in items)
    warnings = []
    if n_cant:
        warnings.append(f"{n_cant} rundown(s) can't be assessed. See each rundown for the reason.")
    if no_snug:
        warnings.append(f"Reference: {no_snug} of {no_snug_of} rundowns had no snug point "
                        "and were left out.")
    if ref.usable < MIN_REF_USABLE:
        warnings.append(f"Reference too small to compare signatures ({ref.usable} usable).")
    if method == "stats":
        warnings.append(f"Fewer than {IF_MIN_COMPLETE} complete reference rundowns: "
                        "statistics only, no Isolation Forest.")
    count = lambda pred: sum(1 for it in items if pred(it))  # noqa: E731
    return _round({
        "warnings": warnings,
        "reference": {"source": source, "rundowns": ref.n},
        "method": method,
        "spec": dict(spec) if spec else None,
        "envelope": ref.env,
        "envelope_pre": ref.pre,
        "rundowns": [_rundown_out(it) for it in items],
        "summary": {"counts": {
            "total": len(items),
            "outside_spec": count(lambda i: i["spec_result"] == "outside"),
            "within_spec": count(lambda i: i["spec_result"] == "within"),
            "spec_not_supplied": count(lambda i: i["spec_result"] == "not_supplied"),
            "spec_incomplete": count(lambda i: i["spec_result"] == "incomplete"),
            "investigate": count(lambda i: i["signature"] == "investigate"),
            "cant_assess": n_cant,
            "typical": count(lambda i: i["signature"] == "typical")}},
    })
