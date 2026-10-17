import pytest

from api.parsing import ParseError, parse_readings

REQ = ["rundown_id", "angle_deg", "torque_nm"]


def two_rundowns():
    return [("a", i, i * 0.5) for i in range(5)] + [("b", i, i * 0.4) for i in range(5)]


def test_minimal_columns(make_csv):
    df = parse_readings(make_csv(REQ, two_rundowns()))
    assert df["rundown_id"].nunique() == 2
    assert (df["assembly_id"] == df["rundown_id"]).all()
    for _, g in df.groupby("rundown_id"):
        assert list(g["i"]) == list(range(len(g)))
    assert list(df.columns) == [
        "rundown_id", "i", "angle_deg", "torque_nm", "time_ms",
        "assembly_id", "bolt_position", "seeded_pattern",
    ]


def test_headers_case_insensitive_and_bom(make_csv):
    data = make_csv(["Rundown_ID", "Angle_Deg", "Torque_Nm"], two_rundowns(), bom=True)
    assert len(parse_readings(data)) == 10


def test_semicolon_separator(make_csv):
    data = make_csv(REQ, two_rundowns(), sep=";")
    assert len(parse_readings(data)) == 10


def test_extra_columns_ignored(make_csv):
    rows = [r + ("x",) for r in two_rundowns()]
    df = parse_readings(make_csv(REQ + ["junk"], rows))
    assert "junk" not in df.columns


def test_sample_index_orders_rows(make_csv):
    rows = [("a", 3, 3.0, 3), ("a", 1, 1.0, 1), ("a", 2, 2.0, 2), ("a", 0, 0.0, 0)]
    df = parse_readings(make_csv(REQ + ["sample_index"], rows))
    assert list(df["angle_deg"]) == [0, 1, 2, 3]
    assert list(df["i"]) == [0, 1, 2, 3]


def test_repeated_angles_kept_in_order(make_csv):
    angles = [0, 1, 1, 1, 2]
    rows = [("a", a, t) for a, t in zip(angles, [0, 1, 2, 3, 4])]
    df = parse_readings(make_csv(REQ, rows))
    assert list(df["torque_nm"]) == [0, 1, 2, 3, 4]


def test_angle_reset_rejected(make_csv):
    angles = [0, 5, 10, 15, 4, 8]  # row 5 drops 11 deg
    rows = [("a", a, 1.0) for a in angles]
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert e.value.row == 5
    assert e.value.column == "angle_deg"


def test_missing_required_column(make_csv):
    rows = [("a", 0), ("a", 1)]
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(["rundown_id", "angle_deg"], rows))
    assert e.value.column == "torque_nm"


def test_too_many_rundowns(make_csv):
    rows = [(f"r{k}", 0, 0.0) for k in range(501)]
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert "500" in e.value.message


def test_non_numeric_torque(make_csv):
    rows = [("a", 0, 1.0), ("a", 1, 2.0), ("a", 2, "abc")]
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert e.value.row == 3
    assert e.value.column == "torque_nm"
