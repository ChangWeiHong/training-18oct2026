"""Per-rundown feature extraction. Never raises on short/odd traces; uncomputable -> None."""
from __future__ import annotations

import math

import numpy as np

FEATURES = ["final_torque", "peak_torque", "total_angle", "snug_angle", "post_snug_angle",
            "running_torque", "slope", "slope_residual", "max_drop", "unload_count"]

FIT_POINTS = 200
UNLOAD_NM = 20.0
DROP_INTERVAL_MIN_NM = 5.0


def snug_index(torque: np.ndarray, snug_nm: float, sustain: int = 3) -> int | None:
    """First index where `sustain` consecutive samples are >= snug_nm (may be 0)."""
    t = np.asarray(torque, dtype=float)
    n = len(t)
    if sustain < 1 or n < sustain:
        return None
    ok = (t >= snug_nm).astype(np.int8)
    run = np.convolve(ok, np.ones(sustain, dtype=np.int8), mode="valid")
    hits = np.flatnonzero(run == sustain)
    return int(hits[0]) if len(hits) else None


def final_index(angle: np.ndarray, torque: np.ndarray) -> int:
    """Last local max within the final 3 % of angle; excludes release decay after it."""
    a = np.asarray(angle, dtype=float)
    t = np.asarray(torque, dtype=float)
    n = len(t)
    if n <= 1:
        return 0
    lo_angle = a[-1] - 0.03 * (a[-1] - a[0])
    start = max(int(np.searchsorted(a, lo_angle, side="left")), 0) if np.all(np.diff(a) >= 0) \
        else max(n - 3, 0)
    start = min(start, n - 2)          # always look at least at the last two samples
    for i in range(n - 1, start - 1, -1):
        left = i == 0 or t[i] >= t[i - 1]
        right = i == n - 1 or t[i] >= t[i + 1]
        if left and right:
            return i
    return n - 1


def _drawdown(torque: np.ndarray) -> tuple[float, int, int]:
    """Largest fall from a running max: (size, index of that max, index of the trough)."""
    t = np.asarray(torque, dtype=float)
    cm = np.maximum.accumulate(t)
    dd = cm - t
    j = int(np.argmax(dd))
    i = int(np.argmax(t[:j + 1] == cm[j])) if dd[j] > 0 else j
    return float(dd[j]), i, j


def drop_interval(angle: np.ndarray, torque: np.ndarray) -> tuple[float, float] | None:
    """Angle span (from, to) of the largest drop; None if the drop is under 5 Nm."""
    a = np.asarray(angle, dtype=float)
    t = np.asarray(torque, dtype=float)
    if len(t) < 2 or len(a) != len(t):
        return None
    size, i, j = _drawdown(t[:final_index(a, t) + 1])
    if not size >= DROP_INTERVAL_MIN_NM:
        return None
    return float(a[i]), float(a[j])


def _unload_count(t: np.ndarray) -> int:
    """Episodes: fall > 20 Nm from a running max, then a rise > 20 Nm from the trough."""
    count, falling, hi, lo = 0, False, t[0], t[0]
    for v in t:
        if not falling:
            hi = max(hi, v)
            if v < hi - UNLOAD_NM:
                falling, lo = True, v
        else:
            lo = min(lo, v)
            if v > lo + UNLOAD_NM:
                count, falling, hi = count + 1, False, v
    return count


def _theil_sen(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float] | None:
    """Median pairwise slope, median intercept, RMSE. x subsampled to <= FIT_POINTS."""
    if len(x) > FIT_POINTS:
        pick = np.linspace(0, len(x) - 1, FIT_POINTS).round().astype(int)
        x, y = x[pick], y[pick]
    dx = x[None, :] - x[:, None]
    dy = y[None, :] - y[:, None]
    iu = np.triu_indices(len(x), 1)
    dx, dy = dx[iu], dy[iu]
    keep = dx != 0
    if keep.sum() < 1:
        return None
    slope = float(np.median(dy[keep] / dx[keep]))
    icpt = float(np.median(y - slope * x))
    rmse = float(np.sqrt(np.mean((y - (icpt + slope * x)) ** 2)))
    return slope, icpt, rmse


def _clean(v):
    if v is None:
        return None
    if isinstance(v, (int, np.integer)):
        return int(v)
    v = float(v)
    return v if math.isfinite(v) else None


def extract(angle: np.ndarray, torque: np.ndarray, snug_nm: float) -> dict[str, float | None]:
    out: dict[str, float | None] = {k: None for k in FEATURES}
    a = np.asarray(angle, dtype=float).ravel()
    t = np.asarray(torque, dtype=float).ravel()
    n = min(len(a), len(t))
    if n == 0:
        return out
    a, t = a[:n], t[:n]
    fi = final_index(a, t)
    out["final_torque"] = t[fi]
    out["peak_torque"] = np.max(t)
    out["total_angle"] = a[fi] - a[0]
    size, _, _ = _drawdown(t[:fi + 1])
    out["max_drop"] = size
    out["unload_count"] = _unload_count(t)

    k = snug_index(t, snug_nm)
    if k is not None:
        out["snug_angle"] = a[k]
        out["post_snug_angle"] = a[fi] - a[k]
        if k > 0:
            out["running_torque"] = np.median(t[:k])
        peak = float(np.max(t))
        above = np.flatnonzero(t[k:] >= 0.9 * peak)
        end = k + int(above[0]) if len(above) else n - 1
        if end - k + 1 >= 3:
            fit = _theil_sen(a[k:end + 1], t[k:end + 1])
            if fit is not None:
                out["slope"], _, out["slope_residual"] = fit
    return {key: _clean(v) for key, v in out.items()}
