"""Illustrative joints: profiles, pack shape, and held-out acceptance."""
from collections import defaultdict

import numpy as np
import pytest

from api.analysis import analyse
from api.synth import (HELDOUT_SEEDS, JOINTS, PACKS, PACK_IDS, WHEEL_HUB, make_pack,
                       make_reference, pack_spec)

NEW_PACKS = [pid for pid in PACKS if pid not in PACK_IDS]
SEEDS = pytest.mark.parametrize("seed", HELDOUT_SEEDS)
NEW = pytest.mark.parametrize("pid", NEW_PACKS)


def test_joint_catalogue():
    assert set(JOINTS) == {"wheel-hub", "caliper", "subframe", "seatbelt", "mount"}
    assert JOINTS["wheel-hub"] is WHEEL_HUB
    assert [JOINTS[j].bolts for j in ("caliper", "subframe", "seatbelt", "mount")] == [2, 4, 1, 3]
    for j in JOINTS.values():
        assert 1 <= j.bolts <= 6
    assert set(NEW_PACKS) == {"caliper-mixed", "caliper-clean", "subframe-mixed", "subframe-drift",
                              "seatbelt-mixed", "mount-mixed"}


def test_wheel_hub_packs_keep_their_spec():
    for pid in PACK_IDS:
        assert PACKS[pid].joint == "wheel-hub"
        assert pack_spec(pid) == {"torque_min_nm": 99, "torque_max_nm": 121, "angle_min_deg": 20,
                                  "angle_max_deg": 60, "snug_torque_nm": 30}


@NEW
def test_new_pack_shape(pid):
    d = PACKS[pid]
    j = JOINTS[d.joint]
    df = make_pack(pid, 7)
    assert 20 <= df["assembly_id"].nunique() <= 40
    assert set(df["bolt_position"]) == set(range(1, j.bolts + 1))
    assert df["rundown_id"].nunique() == df["assembly_id"].nunique() * j.bolts
    ref = make_reference(7, joint=d.joint)
    assert ref["rundown_id"].nunique() == 120
    assert (ref["seeded_pattern"] == "normal").all()
    spec = pack_spec(pid)
    assert spec["snug_torque_nm"] == j.snug_nm
    seeded = set(df["seeded_pattern"]) - {"normal"} - set(d.unscored)
    assert seeded == set(d.patterns)


@NEW
def test_new_pack_deterministic(pid):
    assert make_pack(pid, 101).equals(make_pack(pid, 101))


@NEW
def test_new_pack_curves_sit_in_the_joint_window(pid):
    d = PACKS[pid]
    spec = pack_spec(pid)
    df = make_pack(pid, 7)
    normal = df[df["seeded_pattern"] == "normal"]
    finals = normal.groupby("rundown_id")["torque_nm"].max()
    assert finals.between(spec["torque_min_nm"] - 3, spec["torque_max_nm"] + 3).mean() > 0.9
    assert df["torque_nm"].max() < spec["torque_max_nm"] * 1.5


@SEEDS
@NEW
def test_new_pack_acceptance(pid, seed):
    d = PACKS[pid]
    spec = pack_spec(pid)
    res = analyse(make_pack(pid, seed), make_reference(seed, joint=d.joint), spec)
    rs = res["rundowns"]
    normal = [r for r in rs if r["seeded_pattern"] == "normal"]
    bad = [r for r in normal if r["spec_result"] == "within" and r["signature"] == "investigate"]
    assert len(bad) / len(normal) <= 0.05, (len(bad), len(normal))
    hit, tot = defaultdict(int), defaultdict(int)
    for r in rs:
        p = r["seeded_pattern"]
        if p == "normal" or p in d.unscored:
            continue
        tot[p] += 1
        hit[p] += r["spec_result"] == "outside" or r["signature"] == "investigate"
    assert set(tot) == set(d.patterns)
    for p in tot:
        assert hit[p] / tot[p] >= 0.60, (p, hit[p], tot[p])
