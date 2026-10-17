import time
from collections import defaultdict

import pytest

from api.analysis import analyse
from api.synth import HELDOUT_SEEDS, SAMPLE_SPEC, make_pack, make_reference

SEEDS = pytest.mark.parametrize("seed", HELDOUT_SEEDS)


@SEEDS
def test_clean_pack_false_flag_rate(seed):
    res = analyse(make_pack("clean", seed), make_reference(seed), SAMPLE_SPEC)
    rs = res["rundowns"]
    bad = [r for r in rs if r["spec_result"] == "within" and r["signature"] == "investigate"]
    assert len(bad) / len(rs) <= 0.03


@SEEDS
def test_mixed_pack_recall(seed):
    res = analyse(make_pack("mixed", seed), make_reference(seed), SAMPLE_SPEC)
    hit, tot = defaultdict(int), defaultdict(int)
    for r in res["rundowns"]:
        p = r["seeded_pattern"]
        if p == "normal":
            continue
        tot[p] += 1
        hit[p] += r["spec_result"] == "outside" or r["signature"] == "investigate"
    for p in tot:
        assert hit[p] / tot[p] >= 0.70, (p, hit[p], tot[p])
    assert sum(hit.values()) / sum(tot.values()) >= 0.80


@SEEDS
def test_hard_pack_cant_assess(seed):
    res = analyse(make_pack("hard", seed), make_reference(seed), SAMPLE_SPEC)
    bad = [r for r in res["rundowns"] if r["seeded_pattern"] in ("truncated", "no_snug")]
    assert bad and all(r["signature"] == "cant_assess" for r in bad)


@SEEDS
def test_mixed_pack_timing(seed):
    pack, ref = make_pack("mixed", seed), make_reference(seed)
    analyse(pack, ref, SAMPLE_SPEC)
    t0 = time.perf_counter()
    analyse(pack, ref, SAMPLE_SPEC)
    assert time.perf_counter() - t0 < 2.0
