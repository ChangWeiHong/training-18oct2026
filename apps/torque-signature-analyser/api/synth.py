"""Synthetic torque-angle rundowns and the four built-in sample packs.

Joint: M12x1.75 wheel-hub flange, 6 bolts per assembly. Traces start at angle 0
a little before snug, sampled every 0.5 deg. Generator tuning uses seed 7 only;
HELDOUT_SEEDS are reserved for acceptance tests.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd

SAMPLE_SPEC = {"torque_min_nm": 99, "torque_max_nm": 121, "angle_min_deg": 20,
               "angle_max_deg": 60, "snug_torque_nm": 30}
PATTERNS = ["cross_thread", "missing_washer", "soft_joint", "hard_joint",
            "rehit", "double_hit", "stripped_thread", "early_shutoff"]
HELDOUT_SEEDS = (101, 202, 303)

STEP_DEG = 0.5
DT_MS = 2.0
NOISE_NM = 0.3
SNUG = float(SAMPLE_SPEC["snug_torque_nm"])
RAMP_DEG = 6.0           # pre-snug torque rise
SLOPE_MEAN, SLOPE_SD = 2.2, 0.15
TARGET_MEAN, TARGET_SD = 110.0, 2.5
SNUG_ANGLE_MEAN, SNUG_ANGLE_SD = 30.0, 3.0
ASSEMBLIES, BOLTS = 40, 6
PACK_IDS = ("clean", "mixed", "drift", "hard")


def _post_snug(x: np.ndarray, slope: float, knee: float) -> np.ndarray:
    """Torque above snug at x degrees past snug: slope builds from s/2 to s."""
    return SNUG + slope * x - 0.5 * slope * knee * (1 - np.exp(-x / knee))


def _clean_curve(theta_s, running, slope, target, knee=3.0):
    """Noise-free (angle, torque) up to the first sample at/above target.

    `running` is a scalar or a function of angle for the pre-snug phase.
    """
    a = np.arange(0.0, theta_s + 400.0, STEP_DEG)
    run = running(a) if callable(running) else np.full_like(a, float(running))
    a0 = theta_s - RAMP_DEG
    u = np.clip((a - a0) / RAMP_DEG, 0, 1)
    pre = run + (SNUG - run) * u ** 1.5
    x = np.clip(a - theta_s, 0, None)
    t = np.where(a < theta_s, pre, _post_snug(x, slope, knee))
    end = int(np.argmax(t >= target))
    return a[:end + 1], t[:end + 1]


def _noisy(rng, t):
    return t + rng.normal(0, NOISE_NM, len(t))


def _normal_params(rng):
    return dict(
        theta_s=rng.normal(SNUG_ANGLE_MEAN, SNUG_ANGLE_SD),
        running=rng.uniform(2, 6),
        slope=rng.normal(SLOPE_MEAN, SLOPE_SD),
        target=float(np.clip(rng.normal(TARGET_MEAN, TARGET_SD), 101, 119)),
    )


def _double_hit(rng, p):
    """Two unloading episodes, each followed by reloading; pauses at each."""
    t1, t2 = rng.uniform(50, 65), rng.uniform(82, 95)
    l1, l2 = rng.uniform(10, 18), rng.uniform(30, 45)
    a, t = _clean_curve(p["theta_s"], p["running"], p["slope"], t1)
    A, T, pauses = [a], [t], []
    for peak_next, low in ((t2, l1), (p["target"], l2)):
        n = int(rng.integers(6, 11))
        last_a, last_t = A[-1][-1], T[-1][-1]
        A.append(last_a - np.linspace(0.1, 0.8, n))          # slight back-off
        T.append(np.linspace(last_t, low, n + 1)[1:])
        pauses.append(sum(len(x) for x in A) - 1)
        # reload at ~normal slope from the trough
        s = p["slope"] * rng.uniform(0.9, 1.15)
        m = int(np.ceil((peak_next - low) / s / STEP_DEG)) + 1
        base_a = A[-1][-1]
        xs = np.arange(1, m + 1) * STEP_DEG
        A.append(base_a + xs)
        T.append(np.minimum(low + s * xs, peak_next) if peak_next != p["target"] else low + s * xs)
        if peak_next != p["target"]:
            T[-1][-1] = peak_next
    a, t = np.concatenate(A), np.concatenate(T)
    # first sample of reload starts rising from the trough, so trim past target
    over = np.flatnonzero(t >= p["target"])
    if len(over):
        a, t = a[:over[-1] + 1], t[:over[-1] + 1]
    return a, t, pauses


def _build(rng, pattern, slope_override=None):
    """Returns (angle, torque, pause_indices). Pause indices get an extra time gap."""
    p = _normal_params(rng)
    if slope_override is not None:
        p["slope"] = rng.normal(slope_override, SLOPE_SD)
    pauses: list[int] = []
    if pattern is None:
        a, t = _clean_curve(**p)
    elif pattern == "soft_joint":
        p.update(slope=rng.uniform(0.8, 1.0), target=max(p["target"], 105.0))
        a, t = _clean_curve(**p)
    elif pattern == "hard_joint":
        p.update(slope=rng.uniform(6.0, 7.5), target=float(np.clip(p["target"], 101, 112)))
        a, t = _clean_curve(**p, knee=1.0)
    elif pattern == "missing_washer":
        p.update(theta_s=rng.uniform(58, 70), slope=rng.uniform(1.4, 1.8))
        a, t = _clean_curve(**p)
    elif pattern == "early_shutoff":
        p.update(target=rng.uniform(70, 95))
        a, t = _clean_curve(**p)
    elif pattern == "cross_thread":
        walk = np.cumsum(rng.normal(0, 1.2, 800))
        walk = np.convolve(walk - walk.mean(), np.ones(5) / 5, mode="same")
        base = rng.uniform(18, 22)

        def run(a):
            idx = np.minimum((a / STEP_DEG).astype(int), len(walk) - 1)
            return np.clip(base + walk[idx], 16, 27)

        p["running"] = run
        if rng.random() < 0.4:
            p["target"] = rng.uniform(45, 90)
        a, t = _clean_curve(**p)
    elif pattern == "stripped_thread":
        peak = rng.uniform(82, 96)
        p.update(target=peak)
        a, t = _clean_curve(**p)
        n = int(rng.uniform(15, 25) / STEP_DEG)
        rate = rng.uniform(0.8, 1.5)
        xs = np.arange(1, n + 1) * STEP_DEG
        a = np.concatenate([a, a[-1] + xs])
        t = np.concatenate([t, peak - rate * xs])
    elif pattern == "rehit":
        travel, slope = rng.uniform(3, 10), rng.uniform(1.5, 3.0)
        target = float(np.clip(rng.normal(TARGET_MEAN, TARGET_SD), 101, 119))
        n = int(travel / STEP_DEG) + 1
        a = np.arange(n) * STEP_DEG
        t = (target - slope * travel) + slope * a
    elif pattern == "double_hit":
        a, t, pauses = _double_hit(rng, p)
    else:
        raise ValueError(f"unknown pattern {pattern!r}")
    return a - a[0] if pattern == "rehit" else a, _noisy(rng, t), pauses


def make_rundown(rng: np.random.Generator, pattern: str | None,
                 slope: float | None = None) -> tuple[np.ndarray, np.ndarray]:
    a, t, _ = _build(rng, pattern, slope)
    return np.round(a, 2), np.round(t, 2)


def _hard_case(rng, kind):
    """Hard-pack traces. Returns (angle, torque, pauses)."""
    p = _normal_params(rng)
    if kind == "truncated":
        cut = rng.uniform(15, 27)
        a, t = _clean_curve(**p)
        end = int(np.argmax(t >= cut))
        return a[:end], _noisy(rng, t[:end]), []
    if kind == "no_snug":
        n = int(rng.uniform(40, 80) / STEP_DEG)
        a = np.arange(n) * STEP_DEG
        t = rng.uniform(4, 10) + rng.uniform(0, 3) * a / a[-1]
        t = _noisy(rng, t)
        for pos in rng.choice(np.arange(10, n - 3), 2, replace=False):
            t[pos] = rng.uniform(31, 36)       # isolated spike, never sustained
        return a, t, []
    if kind == "repeated_angle":
        a, t = _clean_curve(**p)
        a = a.copy()
        for start in sorted(rng.choice(np.arange(20, len(a) - 12), 3, replace=False)):
            a[start:start + int(rng.integers(4, 9))] = a[start]
        return a, _noisy(rng, t), []
    if kind == "missing_washer":     # ambiguous: between normal and clear missing washer
        p.update(theta_s=rng.uniform(43, 47), slope=rng.uniform(1.8, 2.0))
        a, t = _clean_curve(**p)
        return a, _noisy(rng, t), []
    raise ValueError(kind)


def _timeline(n, pauses, rng):
    t = np.arange(n) * DT_MS
    for idx in pauses:
        t[idx:] += rng.uniform(300, 800)
    return np.round(t)


def _frame(rid, assembly, bolt, a, t, time_ms, label):
    n = len(a)
    return pd.DataFrame({
        "rundown_id": rid, "i": np.arange(n), "angle_deg": np.round(a, 2),
        "torque_nm": np.round(t, 2), "time_ms": time_ms,
        "assembly_id": assembly, "bolt_position": float(bolt), "seeded_pattern": label,
    })


def _slots(prefix, n_assemblies):
    for k in range(n_assemblies):
        for b in range(1, BOLTS + 1):
            yield k, f"{prefix}{k + 1:02d}", f"{prefix}{k + 1:02d}-{b}", b


def _assemble(frames):
    return pd.concat(frames, ignore_index=True).sort_values(
        ["rundown_id", "i"], kind="stable").reset_index(drop=True)


def _normal_pack(rng, prefix, n_assemblies, slope_for=lambda k: None, labels=None):
    frames = []
    for idx, (k, asm, rid, b) in enumerate(_slots(prefix, n_assemblies)):
        pat = labels[idx] if labels else None
        a, t, pauses = _build(rng, pat, slope_for(k) if pat is None else None)
        frames.append(_frame(rid, asm, b, a, t, _timeline(len(a), pauses, rng), pat or "normal"))
    return _assemble(frames)


def make_pack(pack_id: Literal["clean", "mixed", "drift", "hard"], seed: int) -> pd.DataFrame:
    rng = np.random.default_rng([seed, PACK_IDS.index(pack_id)])
    n = ASSEMBLIES * BOLTS
    if pack_id == "clean":
        return _normal_pack(rng, "A", ASSEMBLIES)
    if pack_id == "drift":
        slopes = np.linspace(2.2, 1.4, ASSEMBLIES)
        return _normal_pack(rng, "A", ASSEMBLIES, slope_for=lambda k: float(slopes[k]))
    if pack_id == "mixed":
        labels = [None] * n
        seeded = PATTERNS * 2 + list(rng.choice(PATTERNS, 4))
        for pos, pat in zip(rng.choice(n, len(seeded), replace=False), seeded):
            labels[pos] = str(pat)
        return _normal_pack(rng, "A", ASSEMBLIES, labels=labels)
    if pack_id == "hard":
        kinds = (["truncated"] * 5 + ["no_snug"] * 4 + ["repeated_angle"] * 5
                 + ["missing_washer"] + [None] * 9)
        kinds = [kinds[i] for i in rng.permutation(len(kinds))]
        frames = []
        for (k, asm, rid, b), kind in zip(_slots("H", 4), kinds):
            if kind is None:
                a, t, pauses = _build(rng, None)
            else:
                a, t, pauses = _hard_case(rng, kind)
            frames.append(_frame(rid, asm, b, a, t, _timeline(len(a), pauses, rng),
                                 kind or "normal"))
        return _assemble(frames)
    raise ValueError(pack_id)


def make_reference(seed: int, n: int = 120) -> pd.DataFrame:
    """n normal rundowns at the start-of-shift slope (2.2 Nm/deg)."""
    rng = np.random.default_rng([seed, 99])
    frames = []
    for j in range(n):
        a, t, _ = _build(rng, None)
        asm = f"R{j // BOLTS + 1:02d}"
        frames.append(_frame(f"R{j + 1:03d}", asm, j % BOLTS + 1, a, t,
                             _timeline(len(a), [], rng), "normal"))
    return _assemble(frames)


PACK_META = {
    "clean": ("Clean shift", "40 assemblies x 6 bolts, all normal with realistic scatter."),
    "mixed": ("Mixed shift", "40 x 6 with about 8% seeded abnormal rundowns across the eight patterns."),
    "drift": ("Gradual drift", "Post-snug slope falls across the shift (worn washer stock)."),
    "hard": ("Hard cases", "Truncated traces, no snug crossing, repeated angles and an ambiguous missing-washer case."),
}


def _write_csv(df: pd.DataFrame, path: Path) -> None:
    out = df.rename(columns={"i": "sample_index"})
    out["bolt_position"] = out["bolt_position"].astype(int)
    out["time_ms"] = out["time_ms"].astype(int)
    out.to_csv(path, index=False, float_format="%.2f")


def write_samples(out_dir: Path, seed: int = 7) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = []
    ref = make_reference(seed)
    for pid in PACK_IDS:
        df = make_pack(pid, seed)
        _write_csv(df, out_dir / f"{pid}.csv")
        _write_csv(ref, out_dir / f"{pid}-reference.csv")
        name, desc = PACK_META[pid]
        meta.append({"id": pid, "name": name, "description": desc,
                     "rundowns": int(df["rundown_id"].nunique()), "spec": SAMPLE_SPEC})
    (out_dir / "packs.json").write_text(json.dumps(meta, indent=2) + "\n")


if __name__ == "__main__":
    write_samples(Path(__file__).parent / "samples")
