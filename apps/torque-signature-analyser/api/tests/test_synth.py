import json

import numpy as np
import pytest

from api.parsing import parse_readings
from api.synth import (PATTERNS, SAMPLE_SPEC, make_pack, make_reference,
                       make_rundown, write_samples)

SNUG = SAMPLE_SPEC["snug_torque_nm"]


def snug_index(t, n=3):
    ok = t >= SNUG
    for k in range(len(t) - n + 1):
        if ok[k:k + n].all():
            return k
    return None


def props(a, t):
    k = snug_index(t)
    return {
        "snug_idx": k,
        "snug_angle": None if k is None else a[k] - a[0],
        "post_snug": None if k is None else a[-1] - a[k],
        "running": np.nan if not k else float(np.median(t[:k])),
        "final": float(t[-1]),
        "peak": float(t.max()),
        "total_angle": float(a[-1] - a[0]),
    }


def unloading_episodes(t, drop=20.0):
    count, state, hi, lo = 0, "up", t[0], t[0]
    for v in t:
        if state == "up":
            hi = max(hi, v)
            if v < hi - drop:
                count, state, lo = count + 1, "down", v
        else:
            lo = min(lo, v)
            if v > lo + drop:
                state, hi = "up", v
    return count


def rundowns(pattern, n=30, seed=7):
    rng = np.random.default_rng(seed)
    return [make_rundown(rng, pattern) for _ in range(n)]


def test_normal_rundown_shape():
    for a, t in rundowns(None, 50):
        p = props(a, t)
        assert len(a) == len(t)
        assert 99 <= p["final"] <= 121
        assert 20 <= p["post_snug"] <= 60
        assert p["running"] < 10


NORMAL = [props(a, t) for a, t in rundowns(None, 50)]
NORMAL_SNUG_MED = float(np.median([p["snug_angle"] for p in NORMAL]))


@pytest.mark.parametrize("pattern", PATTERNS)
def test_each_pattern_distinct(pattern):
    for a, t in rundowns(pattern):
        p = props(a, t)
        assert p["snug_idx"] is not None
        if pattern == "soft_joint":
            assert p["post_snug"] > 70
        elif pattern == "hard_joint":
            assert p["post_snug"] < 18
        elif pattern == "early_shutoff":
            assert p["final"] < 99
            assert p["peak"] - p["final"] < 4
        elif pattern == "stripped_thread":
            assert p["peak"] - p["final"] > 8
        elif pattern == "rehit":
            assert p["total_angle"] < 15
            assert p["snug_idx"] == 0
        elif pattern == "cross_thread":
            assert p["running"] > 15
        elif pattern == "double_hit":
            assert unloading_episodes(t) >= 2
        elif pattern == "missing_washer":
            assert abs(p["snug_angle"] - NORMAL_SNUG_MED) > 25


def test_angles_monotone_enough_for_parser():
    for pat in [None] + PATTERNS:
        for a, _ in rundowns(pat, 10):
            assert np.diff(a).min() > -1.5


def test_pack_sizes():
    for pid in ("clean", "mixed", "drift"):
        df = make_pack(pid, 7)
        assert df["rundown_id"].nunique() == 240
        assert df["assembly_id"].nunique() == 40
        assert set(df["bolt_position"]) == {1, 2, 3, 4, 5, 6}
    mixed = make_pack("mixed", 7).drop_duplicates("rundown_id")
    bad = mixed[mixed["seeded_pattern"] != "normal"]
    assert 15 <= len(bad) <= 25
    counts = bad["seeded_pattern"].value_counts()
    assert set(counts.index) == set(PATTERNS)
    assert counts.min() >= 2
    clean = make_pack("clean", 7)
    assert (clean["seeded_pattern"] == "normal").all()

    hard = make_pack("hard", 7)
    assert hard["rundown_id"].nunique() >= 12
    last = hard.groupby("rundown_id").tail(1)
    assert (last["torque_nm"] < SNUG).any()
    kinds = set(hard["seeded_pattern"])
    assert {"truncated", "no_snug", "repeated_angle", "missing_washer"} <= kinds
    rep = hard[hard["seeded_pattern"] == "repeated_angle"]
    assert rep.groupby("rundown_id")["angle_deg"].apply(lambda s: (s.diff() == 0).any()).all()
    for rid, g in hard[hard["seeded_pattern"] == "no_snug"].groupby("rundown_id"):
        assert snug_index(g["torque_nm"].to_numpy()) is None


def test_pack_deterministic_and_schema():
    a, b = make_pack("mixed", 101), make_pack("mixed", 101)
    assert a.equals(b)
    assert list(a.columns) == ["rundown_id", "i", "angle_deg", "torque_nm", "time_ms",
                               "assembly_id", "bolt_position", "seeded_pattern"]


def test_drift_slope_falls():
    df = make_pack("drift", 7)
    ps = []
    for rid, g in df.groupby("rundown_id"):
        ps.append(props(g["angle_deg"].to_numpy(), g["torque_nm"].to_numpy())["post_snug"])
    ps = np.array(ps)
    assert ps[-48:].mean() > ps[:48].mean() + 10


def test_reference_all_normal():
    ref = make_reference(7)
    assert ref["rundown_id"].nunique() == 120
    assert (ref["seeded_pattern"] == "normal").all()


def test_double_hit_has_pause_in_time():
    df = make_pack("mixed", 7)
    g = df[df["seeded_pattern"] == "double_hit"]
    gaps = g.groupby("rundown_id")["time_ms"].apply(lambda s: s.diff().max())
    assert (gaps > 100).all()
    n = df[df["seeded_pattern"] == "normal"].groupby("rundown_id")["time_ms"].apply(lambda s: s.diff().max())
    assert (n <= 2.01).all()


def test_written_csv_round_trips(tmp_path):
    write_samples(tmp_path)
    packs = json.loads((tmp_path / "packs.json").read_text())
    assert [p["id"] for p in packs] == ["clean", "mixed", "drift", "hard"]
    for p in packs:
        assert p["spec"] == SAMPLE_SPEC
        for name in (f"{p['id']}.csv", f"{p['id']}-reference.csv"):
            f = tmp_path / name
            assert f.stat().st_size < 2_000_000
            df = parse_readings(f.read_bytes())
            assert len(df) > 0
        main = parse_readings((tmp_path / f"{p['id']}.csv").read_bytes())
        assert main["rundown_id"].nunique() == p["rundowns"]
    ref = parse_readings((tmp_path / "clean-reference.csv").read_bytes())
    assert ref["rundown_id"].nunique() == 120
