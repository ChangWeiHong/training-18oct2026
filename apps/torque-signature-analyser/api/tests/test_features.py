import time

import numpy as np

from api.features import FEATURES, drop_interval, extract, final_index, snug_index
from api.synth import PATTERNS, SAMPLE_SPEC, make_rundown

SNUG = float(SAMPLE_SPEC["snug_torque_nm"])


def runs(pattern, n=20, seed=7):
    rng = np.random.default_rng(seed)
    return [make_rundown(rng, pattern) for _ in range(n)]


def test_snug_index_sustained():
    t = np.array([5, 6, 40, 7, 8, 29, 31, 32, 33, 60.0])
    assert snug_index(t, SNUG) == 6
    assert snug_index(np.array([5, 40, 5, 5, 40, 5.0]), SNUG) is None


def test_snug_at_zero_for_rehit():
    for a, t in runs("rehit"):
        assert snug_index(t, SNUG) == 0
        f = extract(a, t, SNUG)
        assert f["post_snug_angle"] < 15
        assert f["running_torque"] is None


def test_no_snug_returns_none():
    # R1: cut a normal trace before torque reaches 30 Nm
    for a, t in runs(None):
        end = int(np.argmax(t >= 30)) - 1
        f = extract(a[:end], t[:end], SNUG)
        assert f["snug_angle"] is None and f["post_snug_angle"] is None and f["slope"] is None
        assert f["final_torque"] is not None


def test_slope_theil_sen_on_normal():
    slopes = [extract(a, t, SNUG)["slope"] for a, t in runs(None, 30)]
    assert abs(np.median(slopes) - 2.2) < 0.5
    assert all(abs(s - 2.2) < 0.5 for s in slopes)


def test_final_excludes_release_decay():
    a, t = runs(None, 1)[0]
    a2 = np.concatenate([a, a[-1] + 0.2 * np.arange(1, 6)])
    t2 = np.concatenate([t, np.linspace(110, 60, 6)[1:]])
    t2[len(t) - 1] = 110.0
    assert extract(a2, t2, SNUG)["final_torque"] > 105
    assert final_index(a2, t2) == len(t) - 1
    assert extract(a2, t2, SNUG)["max_drop"] < 5
    assert drop_interval(a2, t2) is None


def test_unload_count():
    assert all(extract(a, t, SNUG)["unload_count"] == 0 for a, t in runs(None))
    assert all(extract(a, t, SNUG)["unload_count"] >= 2 for a, t in runs("double_hit"))
    assert all(extract(a, t, SNUG)["unload_count"] == 0 for a, t in runs("stripped_thread"))


def test_max_drop_and_interval():
    for a, t in runs("stripped_thread"):
        f = extract(a, t, SNUG)
        assert f["max_drop"] > 8
        lo, hi = drop_interval(a, t)
        assert hi > lo
    for a, t in runs(None):
        assert extract(a, t, SNUG)["max_drop"] < 5
        assert drop_interval(a, t) is None


def test_patterns_separate():
    def med(p, k):
        return float(np.median([extract(a, t, SNUG)[k] for a, t in runs(p)]))
    assert med("soft_joint", "slope") < 1.3
    assert 1.3 < med(None, "slope") < 4
    assert med("hard_joint", "slope") > 4
    assert med("cross_thread", "running_torque") > 15 > med(None, "running_torque")
    assert med("missing_washer", "snug_angle") > med(None, "snug_angle") + 20
    assert med("early_shutoff", "final_torque") < 99
    assert med("stripped_thread", "max_drop") > 8


def test_never_raises_and_json_ready():
    cases = [(np.array([0.0]), np.array([5.0])), (np.array([0.0, 0.0]), np.array([50.0, 50.0])),
             (np.zeros(10), np.full(10, 40.0)), (np.array([]), np.array([])),
             (np.arange(5.0), np.array([np.nan, 1, 2, np.inf, 40]))]
    for a, t in cases:
        f = extract(a, t, SNUG)
        assert list(f) == FEATURES
        assert all(v is None or type(v) in (int, float) and np.isfinite(v) for v in f.values())
    for p in [None] + PATTERNS:
        for a, t in runs(p, 5):
            f = extract(a, t, SNUG)
            assert all(v is None or type(v) in (int, float) for v in f.values())


def test_extract_fast_enough():
    data = runs(None, 240)
    t0 = time.perf_counter()
    for a, t in data:
        extract(a, t, SNUG)
    assert time.perf_counter() - t0 < 1.5
