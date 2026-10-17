import pytest


@pytest.fixture
def make_csv():
    """Build CSV bytes from a header list and row lists."""

    def _make(header, rows, sep=",", bom=False):
        lines = [sep.join(header)] + [sep.join(str(v) for v in r) for r in rows]
        text = "\n".join(lines) + "\n"
        return (("﻿" if bom else "") + text).encode("utf-8")

    return _make
