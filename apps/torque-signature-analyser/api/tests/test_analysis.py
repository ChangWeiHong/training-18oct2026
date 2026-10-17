import json

import numpy as np
import pandas as pd

from api.analysis import analyse
from api.synth import SAMPLE_SPEC, _build, _frame, make_pack, make_reference


def _frames(patterns, seed=7, prefix="X"):
    rng = np.random.default_rng([seed, 5])
    frames = []
    for n, pat in enumerate(patterns):
        a, t, _ = _build(rng, pat)
        frames.append(_frame(f"{prefix}{n}", f"{prefix}A", n % 6 + 1, a, t,
                             np.arange(len(a)) * 2.0, pat or "normal"))
    return pd.concat(frames, ignore_index=True)


def _one(res, rid):
    return next(r for r in res["rundowns"] if r["id"] == rid)


def test_spec_not_supplied():
    res = analyse(_frames([None] * 3), make_reference(7), None)
    assert res["spec"] is None
    assert {r["spec_result"] for r in res["rundowns"]} == {"not_supplied"}


def test_spec_outside_on_low_final():
    res = analyse(_frames([None, "early_shutoff"]), make_reference(7), SAMPLE_SPEC)
    assert _one(res, "X0")["spec_result"] == "within"
    assert _one(res, "X1")["spec_result"] == "outside"
    assert _one(res, "X1")["rank"] == 1


def test_mad_floor_keeps_z_finite():
    ref = make_reference(7)
    # identical running torque: flat 4 Nm before the snug ramp in every reference trace
    ref = ref.copy()
    pre = ref["torque_nm"] < 25
    ref.loc[pre, "torque_nm"] = 4.0
    res = analyse(_frames([None, "cross_thread"]), ref, SAMPLE_SPEC)
    json.dumps(res, allow_nan=False)
    assert _one(res, "X1")["signature"] == "investigate"


def test_small_upload_stats_only():
    res = analyse(_frames([None] * 5), None, SAMPLE_SPEC)
    assert res["method"] == "stats"
    assert res["reference"]["source"] == "within-upload"
    json.dumps(res, allow_nan=False)


def test_cant_assess_when_no_snug():
    hard = make_pack("hard", 7)
    res = analyse(hard, make_reference(7), SAMPLE_SPEC)
    seeded = {r["id"]: r for r in res["rundowns"]}
    bad = [r for r in seeded.values() if r["seeded_pattern"] in ("truncated", "no_snug")]
    assert bad and all(r["signature"] == "cant_assess" for r in bad)
    assert all(r["pattern_hint"] is None for r in bad)


def test_evidence_wording():
    ref = make_reference(7)
    res = analyse(_frames(["soft_joint"]), ref, SAMPLE_SPEC)
    r = res["rundowns"][0]
    assert r["signature"] == "investigate" and not r["iforest_only"]
    ev = r["evidence"][0]
    assert ev["label"] == "Post-snug rotation" and ev["unit"] == "°"
    assert ev["ref_lo"] < ev["ref_hi"] < ev["value"]
    assert ev["interval"][0] < ev["interval"][1]
    assert r["pattern_hint"] == "soft joint"
    assert len(r["evidence"]) <= 3


def test_iforest_only_flag_text():
    ref = make_reference(7)
    res = analyse(make_pack("clean", 7), ref, SAMPLE_SPEC)
    only = [r for r in res["rundowns"] if r["iforest_only"]]
    assert only
    assert all(r["iforest_only"] and r["evidence"] == [] and r["signature"] == "investigate"
               for r in only)


def test_envelope_coverage_nulls():
    env = analyse(_frames([None] * 2), make_reference(7), SAMPLE_SPEC)["envelope"]
    assert len(env["grid"]) == 121 and env["grid"][0] == -30 and env["grid"][-1] == 90
    low = [i for i, c in enumerate(env["coverage"]) if c < 0.7]
    ok = [i for i, c in enumerate(env["coverage"]) if c >= 0.7]
    assert low and ok
    for key in ("p05", "p50", "p95"):
        assert all(env[key][i] is None for i in low)
        assert all(env[key][i] is not None for i in ok)
    assert env["p05"][ok[0]] <= env["p50"][ok[0]] <= env["p95"][ok[0]]


def test_response_shape():
    res = analyse(_frames([None] * 3), make_reference(7), SAMPLE_SPEC, reference_source="sample")
    assert res["reference"] == {"source": "sample", "rundowns": 120}
    assert res["method"] == "stats+iforest"
    assert res["envelope_pre"]["grid"][0] == 0
    r = res["rundowns"][0]
    assert set(r) == {"id", "assembly_id", "bolt_position", "spec_result", "signature", "rank",
                      "features", "evidence", "pattern_hint", "iforest_only", "seeded_pattern",
                      "curve"}
    assert r["curve"]["i"][:3] == [0, 1, 2] and len(r["curve"]["t"]) == len(r["curve"]["angle"])
    json.dumps(res, allow_nan=False)


def test_rehit_is_assessed_with_hint():
    res = analyse(_frames(["rehit"]), make_reference(7), SAMPLE_SPEC)
    r = res["rundowns"][0]
    assert r["signature"] == "investigate" and r["pattern_hint"] == "rehit"


def test_within_upload_full_pack_flags_seeded():
    res = analyse(make_pack("mixed", 7), None, SAMPLE_SPEC)
    assert res["reference"]["source"] == "within-upload" and res["method"] == "stats+iforest"
    seeded = [r for r in res["rundowns"] if r["seeded_pattern"] != "normal"]
    hit = sum(r["spec_result"] == "outside" or r["signature"] == "investigate" for r in seeded)
    assert hit / len(seeded) >= 0.8
    json.dumps(res, allow_nan=False)
