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


@pytest.mark.parametrize("bad,col", [("inf", "torque_nm"), ("-inf", "torque_nm"), ("nan", "torque_nm"),
                                      ("inf", "angle_deg")])
def test_non_finite_rejected(make_csv, bad, col):
    rows = two_rundowns()
    rows[2] = ("a", bad, 1) if col == "angle_deg" else ("a", 2, bad)
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert e.value.row == 3 and e.value.column == col


def test_blank_rundown_id_rejected(make_csv):
    rows = two_rundowns()
    rows[4] = ("", 4, 2.0)
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert e.value.row == 5 and e.value.column == "rundown_id" and e.value.fix


def test_duplicate_headers_after_normalising(make_csv):
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(["rundown_id", "Angle_Deg", "angle_deg", "torque_nm"],
                                [("a", 1, 1, 1), ("a", 2, 2, 2)]))
    assert e.value.column == "angle_deg"


@pytest.mark.parametrize("angle", [1e9, 3601, -11])
def test_angle_range_rejected(make_csv, angle):
    rows = two_rundowns()
    rows[3] = ("a", angle, 2.0)
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(REQ, rows))
    assert e.value.row == 4 and e.value.column == "angle_deg" and e.value.fix


def test_exact_duplicate_headers_rejected(make_csv):
    with pytest.raises(ParseError) as e:
        parse_readings(make_csv(["rundown_id", "angle_deg", "angle_deg", "torque_nm"],
                                [("a", 1, 1, 1), ("a", 2, 2, 2)]))
    assert e.value.column == "angle_deg"


def test_rundown_id_na_is_an_id_not_blank(make_csv):
    rows = [("NA", i, i * 0.5) for i in range(3)] + [("b", i, i * 0.5) for i in range(3)]
    assert set(parse_readings(make_csv(REQ, rows))["rundown_id"]) == {"NA", "b"}


def test_header_over_64_columns_rejected():
    header = ",".join(REQ + [f"x{i}" for i in range(62)])  # 65 columns
    with pytest.raises(ParseError) as e:
        parse_readings((header + "\na,0,1\n").encode())
    assert "65 columns" in e.value.message
    assert e.value.row is None and e.value.column is None and e.value.fix


def test_64_columns_accepted_and_extras_ignored():
    header = ",".join(REQ + [f"x{i}" for i in range(61)])  # 64 columns
    rows = "".join(f"a,{i * 0.5},{i}.0" + ",9" * 61 + "\n" for i in range(5))
    df = parse_readings((header + "\n" + rows).encode())
    assert len(df) == 5


def test_wide_duplicate_header_is_fast_and_reported():
    import time
    header = ",".join(["a"] * 200_000)
    t = time.time()
    with pytest.raises(ParseError):
        parse_readings((header + "\n1\n").encode())
    assert time.time() - t < 2


def test_unknown_columns_not_parsed():
    df = parse_readings(b"rundown_id,angle_deg,torque_nm,junk\na,0,1,x\na,1,2,y\na,2,3,z\n")
    assert "junk" not in df.columns
