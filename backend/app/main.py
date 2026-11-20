"""Lipi Lens API.

Run from backend/:  .venv/Scripts/uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from PIL import UnidentifiedImageError  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from . import dataset, ocr  # noqa: E402
from .preprocess import MODEL_LONG_EDGE, load_image, resize_long_edge, sha256, to_jpeg_bytes  # noqa: E402
from .privacy import blur_sensitive  # noqa: E402
from .transliterate import to_iso, to_simple  # noqa: E402

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

app = FastAPI(title="Lipi Lens API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: dict[str, dict] = {}


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is larger than 10 MB.")
    return data


def _open(data: bytes):
    try:
        return load_image(data)
    except (UnidentifiedImageError, OSError) as e:
        raise HTTPException(400, "That file isn't a readable image (use JPEG or PNG).") from e


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "demo": ocr.is_demo_mode(), "model": ocr.MODEL}


@app.post("/api/read")
async def read(file: UploadFile = File(...)) -> dict:
    data = await _read_upload(file)
    key = sha256(data)
    if key in _cache:
        return {**_cache[key], "cached": True}

    img = _open(data)
    jpeg = to_jpeg_bytes(resize_long_edge(img, MODEL_LONG_EDGE))

    started = time.perf_counter()
    try:
        raw = await ocr.read_sign(jpeg)
    except ocr.OCRError as e:
        raise HTTPException(502, str(e)) from e
    latency_ms = round((time.perf_counter() - started) * 1000)

    lines = []
    for ln in raw.get("lines", []):
        kn = ln.get("kannada", "").strip()
        if not kn:
            continue
        lines.append(
            {
                "kannada": kn,
                "transliteration": to_iso(kn),
                "romanized": to_simple(kn),
                "translation": ln.get("translation", ""),
                "bbox": ln.get("bbox") if len(ln.get("bbox") or []) == 4 else None,
                "confidence": max(0.0, min(1.0, float(ln.get("confidence", 0)))),
            }
        )

    structured = raw.get("structured") or {}
    result = {
        "lines": lines,
        "category": raw.get("category", "other"),
        "structured": structured if structured.get("route_no") or structured.get("destination") else None,
        "image": {"width": img.width, "height": img.height},
        "latency_ms": latency_ms,
        "demo": ocr.is_demo_mode(),
    }
    if not ocr.is_demo_mode():
        _cache[key] = result
    return result


@app.post("/api/contribute")
async def contribute(
    file: UploadFile = File(...),
    lines: str = Form(...),
    consent: bool = Form(...),
    category: str = Form("other"),
    location: str = Form(""),
    conditions: str = Form("[]"),
    contributor: str = Form(""),
) -> dict:
    if not consent:
        raise HTTPException(400, "Consent is required before saving a sample.")
    if category not in ocr.CATEGORIES:
        raise HTTPException(400, f"Unknown category: {category}")
    try:
        parsed_lines = json.loads(lines)
        parsed_conditions = json.loads(conditions)
    except json.JSONDecodeError as e:
        raise HTTPException(400, "Malformed lines/conditions JSON.") from e

    img = _open(await _read_upload(file))
    protect = [ln.get("bbox") for ln in parsed_lines if isinstance(ln, dict) and len(ln.get("bbox") or []) == 4]
    blurred_img, counts = blur_sensitive(img, protect=protect)
    try:
        record = await dataset.add_sample(
            blurred_img, parsed_lines, category, location, parsed_conditions, contributor, counts
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"saved": record["id"], "blurred": counts}


@app.get("/api/stats")
def stats() -> dict:
    return dataset.stats()


@app.get("/api/transliterate")
def transliterate(text: str) -> dict:
    """Used by the contribute form to preview romanisation while editing."""
    return {"iso": to_iso(text), "simple": to_simple(text)}


class ReviewIn(BaseModel):
    lines: list[dict]
    category: str
    reviewed: bool = True


@app.get("/api/review")
def review_list() -> dict:
    rows = dataset.list_records()
    return {"records": [{**r, "image_url": f"/api/images/{Path(r['image']).name}"} for r in rows]}


@app.post("/api/review/{sample_id}")
async def review_save(sample_id: str, body: ReviewIn) -> dict:
    if body.category not in ocr.CATEGORIES:
        raise HTTPException(400, f"Unknown category: {body.category}")
    try:
        rec = await dataset.update_record(sample_id, body.lines, body.category, body.reviewed)
    except KeyError as e:
        raise HTTPException(404, f"No record {sample_id}") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {**rec, "image_url": f"/api/images/{Path(rec['image']).name}"}


@app.post("/api/review/{sample_id}/reject")
async def review_reject(sample_id: str) -> dict:
    try:
        await dataset.reject_record(sample_id)
    except KeyError as e:
        raise HTTPException(404, f"No record {sample_id}") from e
    return {"rejected": sample_id}


# Dataset thumbnails for the Dataset page.
dataset.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/images", StaticFiles(directory=dataset.IMAGES_DIR), name="images")

# Serve the built frontend (frontend/dist) in production from the same origin.
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
