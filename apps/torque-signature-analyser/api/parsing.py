"""CSV parsing and validation for rundown readings."""
from __future__ import annotations

import csv
import io

import numpy as np
import pandas as pd

MAX_BYTES = 5_000_000
MAX_RUNDOWNS = 500
MAX_POINTS = 5000
RESET_TOLERANCE_DEG = 2.0

REQUIRED = ["rundown_id", "angle_deg", "torque_nm"]
OUTPUT_COLUMNS = [
    "rundown_id", "i", "angle_deg", "torque_nm", "time_ms",
    "assembly_id", "bolt_position", "seeded_pattern",
]


class ParseError(Exception):
    def __init__(self, message: str, row: int | None = None,
                 column: str | None = None, fix: str = ""):
        super().__init__(message)
        self.message = message
        self.row = row
        self.column = column
        self.fix = fix


def _numeric(df: pd.DataFrame, col: str, required: bool) -> pd.Series:
    raw = df[col]
    num = pd.to_numeric(raw, errors="coerce")
    bad = num.isna() if required else (num.isna() & raw.notna())
    if bad.any():
        pos = int(np.flatnonzero(bad.to_numpy())[0])
        shown = raw.iloc[pos]
        raise ParseError(
            f"Row {pos + 1}: '{col}' is not a number ({shown!r}).",
            row=pos + 1, column=col,
            fix=f"Put a plain number in '{col}' (use . as the decimal mark).",
        )
    return num.astype(float)


def parse_readings(data: bytes) -> pd.DataFrame:
    if len(data) > MAX_BYTES:
        raise ParseError(
            f"File is larger than {MAX_BYTES // 1_000_000} MB.",
            fix="Split the file into smaller uploads.",
        )
    text = data.decode("utf-8-sig", errors="replace")
    if not text.strip():
        raise ParseError("File is empty.", fix="Upload a CSV with a header row and data.")
    try:
        sep = csv.Sniffer().sniff(text[:4096], delimiters=",;").delimiter
    except csv.Error:
        sep = ","
    try:
        df = pd.read_csv(io.StringIO(text), sep=sep, dtype=str, skipinitialspace=True)
    except Exception as exc:  # malformed CSV
        raise ParseError(f"Could not read CSV: {exc}", fix="Check the file is a valid CSV.")

    df.columns = [str(c).strip().lower() for c in df.columns]
    for col in REQUIRED:
        if col not in df.columns:
            raise ParseError(
                f"Missing required column '{col}'.", column=col,
                fix=f"Add a '{col}' column. Required: {', '.join(REQUIRED)}.",
            )
    if df.empty:
        raise ParseError("File has a header but no data rows.", fix="Add data rows.")

    df["file_row"] = np.arange(1, len(df) + 1)
    df["rundown_id"] = df["rundown_id"].astype(str).str.strip()
    df["angle_deg"] = _numeric(df, "angle_deg", True)
    df["torque_nm"] = _numeric(df, "torque_nm", True)
    df["time_ms"] = _numeric(df, "time_ms", False) if "time_ms" in df else np.nan
    if "sample_index" in df:
        df["sample_index"] = _numeric(df, "sample_index", True)
    if "bolt_position" in df:
        df["bolt_position"] = _numeric(df, "bolt_position", False)
    else:
        df["bolt_position"] = np.nan
    if "assembly_id" in df:
        df["assembly_id"] = df["assembly_id"].fillna(df["rundown_id"]).astype(str).str.strip()
    else:
        df["assembly_id"] = df["rundown_id"]
    if "seeded_pattern" not in df:
        df["seeded_pattern"] = np.nan

    n_rundowns = df["rundown_id"].nunique()
    if n_rundowns > MAX_RUNDOWNS:
        raise ParseError(
            f"{n_rundowns} rundowns found; the limit is {MAX_RUNDOWNS}.",
            column="rundown_id",
            fix=f"Upload at most {MAX_RUNDOWNS} rundowns per file.",
        )

    # Stable sort keeps file order for ties and when no sample_index is given.
    keys = ["rundown_id"] + (["sample_index"] if "sample_index" in df else [])
    df = df.sort_values(keys, kind="stable").reset_index(drop=True)
    df["i"] = df.groupby("rundown_id").cumcount()

    longest = int(df.groupby("rundown_id")["i"].max().max()) + 1
    if longest > MAX_POINTS:
        raise ParseError(
            f"A rundown has {longest} points; the limit is {MAX_POINTS}.",
            column="rundown_id",
            fix=f"Downsample each rundown to at most {MAX_POINTS} points.",
        )

    drop = df.groupby("rundown_id")["angle_deg"].diff()
    bad = drop < -RESET_TOLERANCE_DEG
    if bad.any():
        pos = int(np.flatnonzero(bad.to_numpy())[0])
        row = int(df["file_row"].iloc[pos])
        rid = df["rundown_id"].iloc[pos]
        raise ParseError(
            f"Row {row}: angle drops by {-drop.iloc[pos]:.1f} deg inside rundown "
            f"'{rid}' (looks like two rundowns sharing one id).",
            row=row, column="angle_deg",
            fix="Give each rundown its own rundown_id, or add sample_index to fix the order.",
        )

    return df[OUTPUT_COLUMNS].reset_index(drop=True)
