"""Append contributed, privacy-checked samples to dataset/ (PRD §7)."""
from __future__ import annotations

import asyncio
import json
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

from PIL import Image

from .preprocess import to_jpeg_bytes
from .transliterate import has_kannada, to_iso

ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "dataset"
IMAGES_DIR = DATASET_DIR / "images"
LABELS = DATASET_DIR / "labels.jsonl"
MIN_LONG_EDGE = 1280  # hackathon rule: JPEG, 1280px or larger

_lock = asyncio.Lock()


def _read_all() -> list[dict]:
    if not LABELS.exists():
        return []
    with LABELS.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


async def add_sample(
    img: Image.Image,
    lines: list[dict],
    category: str,
    location: str,
    conditions: list[str],
    contributor: str,
    blurred: dict[str, int],
    extra: dict | None = None,
) -> dict:
    """extra: optional provenance for images not taken by the team, e.g.
    {"source": url, "author": str, "license": "CC-BY-SA-4.0", "geo": {"lat": .., "lon": ..}}.
    Its keys override the defaults (so "license" replaces CC-BY-4.0)."""
    if max(img.size) < MIN_LONG_EDGE:
        raise ValueError(f"Image is {max(img.size)}px on its long edge; the dataset needs at least {MIN_LONG_EDGE}px.")
    clean_lines = []
    for ln in lines:
        kn = (ln.get("kannada") or "").strip()
        if not kn:
            continue
        if "�" in kn or "???" in kn:
            raise ValueError("Text looks garbled (encoding problem). Re-type it as Kannada Unicode.")
        clean_lines.append(
            {
                "kannada": kn,
                "transliteration": to_iso(kn),
                "translation": (ln.get("translation") or "").strip(),
                "bbox": ln.get("bbox") or [],
            }
        )
    if not clean_lines:
        raise ValueError("Add at least one line of Kannada text.")
    if not any(has_kannada(ln["kannada"]) for ln in clean_lines):
        raise ValueError("No Kannada script in the text (English/digits only, or a legacy font encoding).")

    async with _lock:
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        nums = [int(r["id"].split("_")[1]) for r in _read_all() if r.get("id", "").startswith("lipi_")]
        sample_id = f"lipi_{max(nums, default=0) + 1:04d}"
        (IMAGES_DIR / f"{sample_id}.jpg").write_bytes(to_jpeg_bytes(img, quality=92))
        has_english = any(ch.isascii() and ch.isalpha() for ln in clean_lines for ch in ln["kannada"])
        record = {
            "id": sample_id,
            "image": f"images/{sample_id}.jpg",
            "category": category,
            "location": location.strip(),
            "lines": clean_lines,
            "script_mix": "kn+en" if has_english else "kn",
            "conditions": conditions,
            "contributor": contributor.strip() or "anonymous",
            "consent": True,
            "auto_blurred": blurred,
            "reviewed": False,
            "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "license": "CC-BY-4.0",
        }
        if extra:
            record.update({k: v for k, v in extra.items() if v not in (None, "", {})})
        with LABELS.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def stats() -> dict:
    rows = _read_all()
    today = date.today()
    days = [today - timedelta(days=d) for d in range(6, -1, -1)]
    per_day = Counter((r.get("created_at") or "")[:10] for r in rows)
    n = len(rows)
    n_lines = sum(len(r["lines"]) for r in rows)
    return {
        "samples": n,
        "lines": n_lines,
        "reviewed": sum(1 for r in rows if r.get("reviewed")),
        "avg_lines": round(n_lines / n, 1) if n else 0,
        "mixed_script": sum(1 for r in rows if r.get("script_mix") == "kn+en"),
        "by_category": dict(Counter(r["category"] for r in rows)),
        "by_condition": dict(Counter(c for r in rows for c in r.get("conditions", []))),
        "by_contributor": dict(Counter(r.get("contributor", "anonymous") for r in rows).most_common(5)),
        "by_day": [{"date": d.isoformat(), "count": per_day.get(d.isoformat(), 0)} for d in days],
        "recent": [
            {
                "id": r["id"],
                "image": f"/api/images/{Path(r['image']).name}",
                "kannada": r["lines"][0]["kannada"],
                "translation": r["lines"][0].get("translation", ""),
                "category": r["category"],
                "reviewed": bool(r.get("reviewed")),
            }
            for r in reversed(rows[-8:])
        ],
    }


# ---------------------------------------------------------------- review

REJECTED_DIR = DATASET_DIR / "rejected"


def _write_all(rows: list[dict]) -> None:
    tmp = LABELS.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    tmp.replace(LABELS)


def list_records() -> list[dict]:
    return _read_all()


async def update_record(sample_id: str, lines: list[dict], category: str, reviewed: bool) -> dict:
    """Save a human-corrected record. Transliteration is recomputed from the corrected Kannada."""
    clean = []
    for ln in lines:
        kn = (ln.get("kannada") or "").strip()
        if not kn:
            continue
        if "�" in kn or "???" in kn:
            raise ValueError("Text looks garbled (encoding problem). Re-type it as Kannada Unicode.")
        bbox = ln.get("bbox") or []
        clean.append(
            {
                "kannada": kn,
                "transliteration": to_iso(kn),
                "translation": (ln.get("translation") or "").strip(),
                "bbox": bbox if len(bbox) == 4 else [],
            }
        )
    if not clean or not any(has_kannada(ln["kannada"]) for ln in clean):
        raise ValueError("Keep at least one line with Kannada text, or reject the photo.")
    async with _lock:
        rows = _read_all()
        for r in rows:
            if r["id"] == sample_id:
                r["lines"] = clean
                r["category"] = category
                r["script_mix"] = (
                    "kn+en" if any(ch.isascii() and ch.isalpha() for ln in clean for ch in ln["kannada"]) else "kn"
                )
                r["reviewed"] = reviewed
                r["reviewed_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                _write_all(rows)
                return r
    raise KeyError(sample_id)


async def reject_record(sample_id: str) -> None:
    """Drop a record from the dataset; its image is moved to dataset/rejected/ (not deleted)."""
    async with _lock:
        rows = _read_all()
        keep = [r for r in rows if r["id"] != sample_id]
        if len(keep) == len(rows):
            raise KeyError(sample_id)
        rec = next(r for r in rows if r["id"] == sample_id)
        img = DATASET_DIR / rec["image"]
        if img.exists():
            REJECTED_DIR.mkdir(parents=True, exist_ok=True)
            img.replace(REJECTED_DIR / img.name)
        _write_all(keep)
