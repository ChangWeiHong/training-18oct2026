import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app

SAMPLES = Path(__file__).resolve().parent.parent / "samples"
HEADER = "rundown_id,sample_index,angle_deg,torque_nm,time_ms,assembly_id,bolt_position,seeded_pattern"

client = TestClient(app)


def pack_spec(pid):
    return next(p for p in json.loads((SAMPLES / "packs.json").read_text()) if p["id"] == pid)["spec"]


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200 and r.json() == {"ok": True}


def test_samples_list():
    r = client.get("/api/samples")
    assert r.status_code == 200
    packs = r.json()
    assert [p["id"] for p in packs] == ["clean", "mixed", "drift", "hard"]
    assert packs[0]["csv_url"] == "/api/samples/clean.csv"
    assert packs[0]["reference_url"] == "/api/samples/clean-reference.csv"
    assert client.get(packs[1]["csv_url"]).status_code == 200
    assert client.get(packs[1]["reference_url"]).status_code == 200
    assert client.get("/api/samples/nope.csv").status_code == 404


def test_analyse_by_sample_id():
    r = client.post("/api/analyse", json={"sample_id": "mixed"})
    assert r.status_code == 200
    body = r.json()
    assert body["reference"]["source"] == "sample"
    assert body["summary"]["counts"]["total"] == 240


def test_unknown_sample_404():
    r = client.post("/api/analyse", json={"sample_id": "zzz"})
    assert r.status_code == 404
    assert set(r.json()) == {"error", "row", "column", "fix"}


def test_multipart_matches_sample():
    a = client.post("/api/analyse", json={"sample_id": "mixed"}).json()
    r = client.post(
        "/api/analyse",
        files={"readings": ("mixed.csv", (SAMPLES / "mixed.csv").read_bytes(), "text/csv"),
               "reference": ("ref.csv", (SAMPLES / "mixed-reference.csv").read_bytes(), "text/csv")},
        data={"spec": json.dumps(pack_spec("mixed"))},
    )
    assert r.status_code == 200
    b = r.json()
    assert b["reference"]["source"] == "supplied"
    pick = lambda d: {x["id"]: (x["signature"], x["spec_result"]) for x in d["rundowns"]}  # noqa: E731
    assert pick(a) == pick(b)


def test_multipart_without_reference_is_within_upload():
    r = client.post("/api/analyse",
                    files={"readings": ("c.csv", (SAMPLES / "clean.csv").read_bytes(), "text/csv")})
    assert r.status_code == 200
    assert r.json()["reference"]["source"] == "within-upload"


def test_oversize_400():
    r = client.post("/api/analyse", files={"readings": ("big.csv", b"x" * 6_000_000, "text/csv")})
    assert r.status_code == 400
    j = r.json()
    assert j["fix"] and set(j) == {"error", "row", "column", "fix"}


def test_bad_csv_400():
    r = client.post("/api/analyse", files={"readings": ("b.csv", b"rundown_id,angle_deg,torque_nm\nA,1,abc\n", "text/csv")})
    assert r.status_code == 400
    j = r.json()
    assert j["row"] == 1 and j["column"] == "torque_nm" and j["fix"]


def test_bad_reference_prefixed():
    good = (SAMPLES / "clean.csv").read_bytes()
    r = client.post("/api/analyse", files={
        "readings": ("a.csv", good, "text/csv"),
        "reference": ("r.csv", b"rundown_id,angle_deg,torque_nm\nA,1,abc\n", "text/csv")})
    assert r.status_code == 400
    assert r.json()["error"].startswith("Reference file: ")


@pytest.mark.parametrize("spec", [
    "not json",
    json.dumps({"torque_min_nm": 1}),
    json.dumps({"torque_min_nm": 5, "torque_max_nm": 1, "angle_min_deg": 1, "angle_max_deg": 2, "snug_torque_nm": 3}),
    json.dumps({"torque_min_nm": "a", "torque_max_nm": 1, "angle_min_deg": 1, "angle_max_deg": 2, "snug_torque_nm": 3}),
])
def test_bad_spec_400(spec):
    r = client.post("/api/analyse", data={"spec": spec},
                    files={"readings": ("c.csv", (SAMPLES / "clean.csv").read_bytes(), "text/csv")})
    assert r.status_code == 400
    assert r.json()["fix"]


def test_missing_readings_400():
    r = client.post("/api/analyse", data={"spec": "{}"})
    assert r.status_code == 400
    assert set(r.json()) == {"error", "row", "column", "fix"}


def test_analysis_failure_500(monkeypatch):
    import api.main as m

    def boom(*a, **k):
        raise RuntimeError("x")

    monkeypatch.setattr(m, "analyse", boom)
    r = client.post("/api/analyse", json={"sample_id": "clean"})
    assert r.status_code == 500
    assert r.json()["error"] == "Analysis failed. Check the file matches the template."


def test_template_csv():
    r = client.get("/api/template.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "torque-template.csv" in r.headers["content-disposition"]
    lines = r.text.strip().splitlines()
    assert lines[0] == HEADER and len(lines) == 4
    from api.parsing import parse_readings
    parse_readings(r.content)


def test_spa_fallback_and_no_shadow(tmp_path, monkeypatch):
    import api.main as m

    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "x.js").write_text("console.log(1)")
    c = TestClient(m.create_app(tmp_path))
    assert c.get("/healthz").json() == {"ok": True}
    assert c.get("/").text == "<html>app</html>"
    assert c.get("/some/route").text == "<html>app</html>"
    assert c.get("/x.js").text == "console.log(1)"
    assert c.get("/../../etc/passwd").text == "<html>app</html>"
    r = c.get("/api/nothing")
    assert r.status_code == 404 and "error" in r.json()
    assert c.get("/api/samples").status_code == 200


def _bad_upload(body: bytes, header="rundown_id,angle_deg,torque_nm\n"):
    r = client.post("/api/analyse", files={"readings": ("b.csv", header.encode() + body, "text/csv")})
    assert r.status_code == 400
    j = r.json()
    assert set(j) == {"error", "row", "column", "fix"} and j["fix"]
    return j


@pytest.mark.parametrize("body,col", [(b"A,1,inf\n", "torque_nm"), (b",1,2\n", "rundown_id"),
                                       (b"A,1e9,2\n", "angle_deg")])
def test_bad_values_400_not_500(body, col):
    assert _bad_upload(body)["column"] == col


def test_duplicate_header_400():
    j = _bad_upload(b"A,1,2,3\n", header="rundown_id,Angle_Deg,angle_deg,torque_nm\n")
    assert j["column"] == "angle_deg"


def test_oversize_reference_400():
    good = (SAMPLES / "clean.csv").read_bytes()
    r = client.post("/api/analyse", files={
        "readings": ("a.csv", good, "text/csv"),
        "reference": ("r.csv", b"x" * 6_000_000, "text/csv")})
    assert r.status_code == 400
    assert r.json()["error"] == "Reference file is larger than 5 MB."


def test_bad_reference_file_prefix_via_values():
    good = (SAMPLES / "clean.csv").read_bytes()
    r = client.post("/api/analyse", files={
        "readings": ("a.csv", good, "text/csv"),
        "reference": ("r.csv", b"rundown_id,angle_deg,torque_nm\nA,1,inf\n", "text/csv")})
    assert r.status_code == 400
    j = r.json()
    assert j["error"].startswith("Reference file: ") and j["column"] == "torque_nm"


def test_content_length_rejected_before_form_parse():
    r = client.post("/api/analyse", content=b"x",
                    headers={"content-type": "multipart/form-data; boundary=x",
                             "content-length": str(2 * 5_000_000 + 65537)})
    assert r.status_code == 400
    assert set(r.json()) == {"error", "row", "column", "fix"}
