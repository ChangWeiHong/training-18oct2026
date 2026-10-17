"""FastAPI app: samples, template, analyse, and the built web UI."""
from __future__ import annotations

import json
import logging
import math
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException

from api.analysis import analyse
from api.parsing import MAX_BYTES, ParseError, parse_readings

log = logging.getLogger("torque")

SAMPLES_DIR = Path(__file__).resolve().parent / "samples"
DEFAULT_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
SPEC_KEYS = ["torque_min_nm", "torque_max_nm", "angle_min_deg", "angle_max_deg", "snug_torque_nm"]
TEMPLATE = (
    "rundown_id,sample_index,angle_deg,torque_nm,time_ms,assembly_id,bolt_position,seeded_pattern\n"
    "A01-1,0,0.0,4.0,0,A01,1,\n"
    "A01-1,1,0.5,12.5,2,A01,1,\n"
    "A01-1,2,1.0,31.0,4,A01,1,\n"
)


class ApiError(Exception):
    def __init__(self, status: int, error: str, fix: str = "",
                 row: int | None = None, column: str | None = None):
        self.status, self.error, self.fix, self.row, self.column = status, error, fix, row, column


def _err_response(status: int, error: str, fix: str = "", row=None, column=None) -> JSONResponse:
    return JSONResponse({"error": error, "row": row, "column": column, "fix": fix}, status_code=status)


BODY_LIMIT = 2 * MAX_BYTES + 65536
TOO_LARGE = ("The upload is too large.", "Keep each file under 5 MB.")


class _BodyTooLarge(Exception):
    pass


class BodyLimitMiddleware:
    """Counts request-body bytes as they arrive on POST /api/analyse, whatever Content-Length says."""

    def __init__(self, app, limit: int = BODY_LIMIT):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] != "/api/analyse":
            return await self.app(scope, receive, send)
        total, started = 0, False

        async def counted():
            nonlocal total
            msg = await receive()
            if msg["type"] == "http.request":
                total += len(msg.get("body", b""))
                if total > self.limit:
                    raise _BodyTooLarge
            return msg

        async def watch(msg):
            nonlocal started
            started = started or msg["type"] == "http.response.start"
            await send(msg)

        try:
            await self.app(scope, counted, watch)
        except _BodyTooLarge:
            if started:
                raise
            await _err_response(400, *TOO_LARGE)(scope, receive, send)


def _packs() -> list[dict]:
    return json.loads((SAMPLES_DIR / "packs.json").read_text())


@lru_cache(maxsize=None)
def _sample_frames(sample_id: str):
    readings = parse_readings((SAMPLES_DIR / f"{sample_id}.csv").read_bytes())
    reference = parse_readings((SAMPLES_DIR / f"{sample_id}-reference.csv").read_bytes())
    return readings, reference


def _pack(sample_id) -> dict:
    for p in _packs():
        if p["id"] == sample_id:
            return p
    raise ApiError(404, f"Unknown sample '{sample_id}'.",
                   "Pick one of: " + ", ".join(p["id"] for p in _packs()) + ".")


def _parse_spec(raw) -> dict | None:
    if raw is None or raw == "":
        return None
    fix = ("Send spec as JSON with torque_min_nm, torque_max_nm, angle_min_deg, "
           "angle_max_deg and snug_torque_nm, with each min below its max.")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raise ApiError(400, "Spec is not valid JSON.", fix)
    if not isinstance(raw, dict):
        raise ApiError(400, "Spec must be a JSON object.", fix)
    out = {}
    for k in SPEC_KEYS:
        v = raw.get(k)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ApiError(400, f"Spec value '{k}' is missing or not a number.", fix, column=k)
        out[k] = float(v)
    if out["torque_min_nm"] >= out["torque_max_nm"]:
        raise ApiError(400, "Spec torque minimum must be below the maximum.", fix)
    if out["angle_min_deg"] >= out["angle_max_deg"]:
        raise ApiError(400, "Spec angle minimum must be below the maximum.", fix)
    return out


async def _read_upload(f, label: str) -> bytes:
    data = await f.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ApiError(400, f"{label} is larger than {MAX_BYTES // 1_000_000} MB.",
                       "Split the file into smaller uploads.")
    return data


async def _parse_upload(data: bytes, reference: bool):
    try:
        return await run_in_threadpool(parse_readings, data)
    except ParseError as e:
        msg = ("Reference file: " + e.message) if reference else e.message
        raise ApiError(400, msg, e.fix, e.row, e.column)


def create_app(dist: Path | None = DEFAULT_DIST) -> FastAPI:
    app = FastAPI(title="Torque Signature Analyser")
    app.add_middleware(BodyLimitMiddleware)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError):
        return _err_response(e.status, e.error, e.fix, e.row, e.column)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, e: StarletteHTTPException):
        return _err_response(e.status_code, str(e.detail), "Check the request and try again.")

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, e: RequestValidationError):
        return _err_response(400, "The request is not valid.", "Check the request and try again.")

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.get("/api/samples")
    def samples():
        return [{**p, "csv_url": f"/api/samples/{p['id']}.csv",
                 "reference_url": f"/api/samples/{p['id']}-reference.csv"} for p in _packs()]

    def _sample_csv(name: str) -> Response:
        ids = {p["id"] for p in _packs()}
        base = name[: -len("-reference")] if name.endswith("-reference") else name
        if base not in ids:
            raise ApiError(404, f"Unknown sample '{base}'.", "Pick one of: " + ", ".join(sorted(ids)) + ".")
        return FileResponse(SAMPLES_DIR / f"{name}.csv", media_type="text/csv",
                            filename=f"{name}.csv")

    @app.get("/api/samples/{name}.csv")
    def sample_csv(name: str):
        return _sample_csv(name)

    @app.get("/api/template.csv")
    def template():
        return Response(TEMPLATE, media_type="text/csv",
                        headers={"Content-Disposition": 'attachment; filename="torque-template.csv"'})

    @app.post("/api/analyse")
    async def analyse_endpoint(request: Request):
        ctype = request.headers.get("content-type", "")
        reference_source = None
        if ctype.startswith("application/json"):
            try:
                body = await request.json()
            except ValueError:
                raise ApiError(400, "Request body is not valid JSON.", "Send {\"sample_id\": \"clean\"}.")
            if not isinstance(body, dict) or "sample_id" not in body:
                raise ApiError(400, "sample_id is required.", "Send {\"sample_id\": \"clean\"}.")
            pack = _pack(body["sample_id"])
            readings, reference = _sample_frames(pack["id"])
            if "spec" not in body:
                spec = pack["spec"]  # key left out: the pack's own spec
            else:
                spec = _parse_spec(body["spec"])  # explicit null: no spec
            reference_source = "sample"
        elif ctype.startswith("multipart/form-data"):
            try:
                length = int(request.headers.get("content-length", "0"))
            except ValueError:
                length = 0
            if length > BODY_LIMIT:      # early exit; the middleware enforces it for streamed bodies
                raise ApiError(400, *TOO_LARGE)
            form = await request.form()
            up, ref_up = form.get("readings"), form.get("reference")
            if not hasattr(up, "read"):
                raise ApiError(400, "No readings file was uploaded.",
                               "Attach a CSV in the 'readings' field.")
            spec = _parse_spec(form.get("spec"))
            readings = await _parse_upload(await _read_upload(up, "Readings file"), False)
            reference = None
            if hasattr(ref_up, "read"):
                data = await _read_upload(ref_up, "Reference file")
                if data.strip():
                    reference = await _parse_upload(data, True)
                    reference_source = "supplied"
        else:
            raise ApiError(400, "Unsupported request type.",
                           "Send JSON with sample_id, or multipart with a readings file.")
        try:
            return await run_in_threadpool(analyse, readings, reference, spec, reference_source)
        except Exception:
            log.exception("analyse failed")
            raise ApiError(500, "Analysis failed. Check the file matches the template.",
                           "Download the template CSV and compare your columns and values.")

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
                   include_in_schema=False)
    def api_not_found(rest: str):
        raise ApiError(404, "Not found.", "Check the URL.")

    if dist is not None and dist.is_dir():
        root = dist.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            candidate = (root / path).resolve()
            if path and candidate.is_file() and candidate.is_relative_to(root):
                return FileResponse(candidate)
            return FileResponse(root / "index.html")

    return app


app = create_app()
