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
                      "curve", "cant_assess_reason"}
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


def _flat(rid, torque, n=8):
    a = np.arange(n) * 1.0
    return pd.DataFrame({"rundown_id": rid, "i": np.arange(n), "angle_deg": a,
                         "torque_nm": np.full(n, torque), "time_ms": np.nan,
                         "assembly_id": rid, "bolt_position": np.nan, "seeded_pattern": "normal"})


def test_huge_angles_cannot_blow_up_grid():
    df = _flat("H", 50.0)
    df["angle_deg"] = [0, 1, 2, 3, 4, 5, 6, 1e9]
    df["torque_nm"] = [2, 5, 10, 20, 31, 40, 60, 80.0]
    res = analyse(df, make_reference(7), SAMPLE_SPEC)
    assert len(res["envelope_pre"]["grid"]) <= 2000
    huge = pd.concat([df, _frames([None] * 3)], ignore_index=True)
    assert len(analyse(huge, None, SAMPLE_SPEC)["envelope_pre"]["grid"]) <= 2000


def test_no_snug_110_with_spec_is_incomplete():
    res = analyse(_flat("N", 110.0, n=2), make_reference(7), SAMPLE_SPEC)
    r = res["rundowns"][0]
    assert r["features"]["post_snug_angle"] is None
    assert r["spec_result"] == "incomplete" and r["signature"] == "cant_assess"
    assert res["summary"]["counts"]["spec_incomplete"] == 1


def test_no_snug_70_is_outside_even_if_angle_unassessable():
    res = analyse(_flat("N", 70.0, n=2), make_reference(7), SAMPLE_SPEC)
    assert res["rundowns"][0]["spec_result"] == "outside"


def test_reference_too_small_cant_assess():
    ref = make_reference(7)
    ids = ref["rundown_id"].unique()[:10]
    res = analyse(_frames([None] * 3), ref[ref["rundown_id"].isin(ids)], SAMPLE_SPEC)
    assert {r["signature"] for r in res["rundowns"]} == {"cant_assess"}
    assert "Reference too small to compare signatures (10 usable)." in res["warnings"]


def test_reference_without_snug_cant_assess_and_warns():
    ref = pd.concat([_flat(f"F{i}", 10.0) for i in range(30)], ignore_index=True)
    res = analyse(_frames([None] * 3), ref, SAMPLE_SPEC)
    assert {r["signature"] for r in res["rundowns"]} == {"cant_assess"}
    assert "Reference: 30 of 30 rundowns had no snug point and were left out." in res["warnings"]


def test_reference_partly_excluded_warns_but_still_assesses():
    ref = pd.concat([make_reference(7), _flat("F0", 10.0), _flat("F1", 10.0)], ignore_index=True)
    n = ref["rundown_id"].nunique()
    res = analyse(_frames([None] * 3), ref, SAMPLE_SPEC)
    assert f"Reference: 2 of {n} rundowns had no snug point and were left out." in res["warnings"]
    assert not any(w.startswith("Reference too small") for w in res["warnings"])
    assert {r["signature"] for r in res["rundowns"]} <= {"typical", "investigate"}


def test_overlap_counts_gaps_and_empty_envelope():
    from api.analysis import GRID, _overlap, _prep
    run = _prep(_frames([None]), 30.0)[0]
    full = np.where(GRID >= 0, 1.0, np.nan)
    assert _overlap(run, full) == 1.0
    assert _overlap(run, np.full(len(GRID), np.nan)) == 0.0
    holed = full.copy()
    holed[(GRID >= 3) & (GRID < 30)] = np.nan     # hole in the middle of the span
    assert _overlap(run, holed) < 0.5


def test_cant_assess_reasons():
    res = analyse(_flat("N", 70.0, n=2), make_reference(7), SAMPLE_SPEC)
    assert res["rundowns"][0]["cant_assess_reason"] == "No snug point or slope."
    ref = make_reference(7)
    small = ref[ref["rundown_id"].isin(ref["rundown_id"].unique()[:10])]
    res = analyse(_frames([None]), small, SAMPLE_SPEC)
    assert res["rundowns"][0]["cant_assess_reason"] == "Reference too small to compare."
    assert "1 rundown(s) can't be assessed. See each rundown for the reason." in res["warnings"]
    ok = analyse(_frames([None]), ref, SAMPLE_SPEC)["rundowns"][0]
    assert ok["cant_assess_reason"] is None


def _ramp(rid, post, slope=2.2, snug=30.0):
    """Linear rundown: ramp to the snug torque, then `post` degrees at `slope`."""
    a = np.arange(0, snug / slope + post + 0.5, 0.5)
    return pd.DataFrame({"rundown_id": rid, "i": np.arange(len(a)), "angle_deg": a,
                         "torque_nm": slope * a, "time_ms": np.nan, "assembly_id": rid,
                         "bolt_position": np.nan, "seeded_pattern": "normal"})


def _short_ref(n=40, post=10):
    return pd.concat([_ramp(f"S{i}", post, slope=2.2 + 0.01 * (i % 5)) for i in range(n)],
                     ignore_index=True)


def test_rotation_past_reference_is_investigate_with_evidence():
    res = analyse(_ramp("LONG", 100), _short_ref(), None)
    r = res["rundowns"][0]
    assert r["signature"] == "investigate" and r["cant_assess_reason"] is None
    ev = next(e for e in r["evidence"] if e["feature"] == "rotation_past_reference")
    assert ev["label"] == "Rotation past the reference curve" and ev["unit"] == "°"
    assert ev["ref_lo"] == 0 and ev["ref_hi"] == 0
    assert 85 <= ev["value"] <= 92
    lo, hi = ev["interval"]
    assert hi > lo and abs(hi - r["curve"]["angle"][-1]) < 1


def test_candidate_inside_reference_has_no_past_evidence():
    res = analyse(_ramp("OK", 8), _short_ref(), None)
    assert all(e["feature"] != "rotation_past_reference" for e in res["rundowns"][0]["evidence"])


def test_mid_span_gap_below_half_is_cant_assess():
    from api.analysis import GRID, _overlap, _prep
    run = _prep(_ramp("G", 60), 30.0)[0]
    holed = np.where(GRID >= 0, 1.0, np.nan)
    holed[(GRID >= 5) & (GRID <= 40)] = np.nan
    assert _overlap(run, holed) < 0.5
    from api.analysis import _past_reference
    assert _past_reference(run, holed) is None


def test_reference_no_snug_runs_do_not_change_stats():
    base = make_reference(7)
    with_flat = pd.concat([base] + [_flat(f"F{i}", 10.0) for i in range(5)], ignore_index=True)
    a = analyse(_frames([None, "soft_joint", "cross_thread"]), base, SAMPLE_SPEC)
    b = analyse(_frames([None, "soft_joint", "cross_thread"]), with_flat, SAMPLE_SPEC)
    assert a["envelope"] == b["envelope"] and a["envelope_pre"] == b["envelope_pre"]
    for x, y in zip(a["rundowns"], b["rundowns"]):
        assert (x["signature"], x["evidence"], x["iforest_only"]) == (y["signature"], y["evidence"], y["iforest_only"])


def test_thin_tail_support_still_reads_as_past_reference():
    # Snug-aligned coverage only ever shrinks with rotation, so a mid-span gap cannot arise from a
    # real reference (the unit test above covers the gap rule). Thin tail support (8 of 33 runs
    # reach 60 deg, under MIN_COVERAGE) therefore reads as running past the reference.
    short = [_ramp(f"S{i}", 10) for i in range(25)]
    long_ = [_ramp(f"L{i}", 60) for i in range(8)]
    res = analyse(_ramp("C", 60), pd.concat(short + long_, ignore_index=True), None)
    r = res["rundowns"][0]
    assert r["signature"] == "investigate"
    assert any(e["feature"] == "rotation_past_reference" for e in r["evidence"])


def test_within_upload_no_snug_warning_survives_refit():
    runs = pd.concat([_frames([None] * 40), _flat("F0", 10.0), _flat("F1", 10.0)], ignore_index=True)
    res = analyse(runs, None, SAMPLE_SPEC)
    assert res["reference"]["source"] == "within-upload"
    assert res["reference"]["rundowns"] < 42          # the refit happened
    assert "Reference: 2 of 42 rundowns had no snug point and were left out." in res["warnings"]
