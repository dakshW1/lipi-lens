"""Check dataset/ against the hackathon data rules before submission.

  backend/.venv/Scripts/python scripts/validate_dataset.py

Checks: JSON schema, UTF-8 Kannada Unicode (no legacy font encodings),
JPEG with long edge >= 1280px, consent recorded, image file exists,
transliteration matches the deterministic library output.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from PIL import Image  # noqa: E402

from app.dataset import DATASET_DIR, LABELS, MIN_LONG_EDGE  # noqa: E402
from app.ocr import CATEGORIES  # noqa: E402
from app.transliterate import has_kannada, to_iso  # noqa: E402

REQUIRED = {"id", "image", "category", "lines", "consent", "license"}


def check(rec: dict) -> list[str]:
    errs = []
    missing = REQUIRED - rec.keys()
    if missing:
        return [f"missing fields {sorted(missing)}"]
    if rec["category"] not in CATEGORIES:
        errs.append(f"bad category {rec['category']!r}")
    if rec["consent"] is not True:
        errs.append("no consent")
    img_path = DATASET_DIR / rec["image"]
    if not img_path.exists():
        errs.append("image file missing")
    else:
        with Image.open(img_path) as im:
            if im.format != "JPEG":
                errs.append(f"image is {im.format}, not JPEG")
            if max(im.size) < MIN_LONG_EDGE:
                errs.append(f"image long edge {max(im.size)}px < {MIN_LONG_EDGE}")
    if not rec["lines"]:
        errs.append("no lines")
    if not any(has_kannada(ln["kannada"]) for ln in rec["lines"]):
        # Legacy encodings (Nudi/Baraha) show up as Latin gibberish with no Kannada code points.
        errs.append("no Kannada Unicode in any line (legacy font encoding?)")
    for i, ln in enumerate(rec["lines"]):
        if "�" in ln["kannada"] or "???" in ln["kannada"]:
            errs.append(f"line {i}: garbled text")
        if ln.get("transliteration") != to_iso(ln["kannada"]):
            errs.append(f"line {i}: transliteration out of date")
    return errs


def main() -> int:
    if not LABELS.exists():
        print("No dataset/labels.jsonl yet.")
        return 1
    bad = 0
    total = 0
    ids = set()
    with LABELS.open(encoding="utf-8") as f:
        for n, raw in enumerate(f, 1):
            if not raw.strip():
                continue
            total += 1
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"line {n}: invalid JSON ({e})")
                bad += 1
                continue
            errs = check(rec)
            if rec.get("id") in ids:
                errs.append("duplicate id")
            ids.add(rec.get("id"))
            if errs:
                bad += 1
                print(f"{rec.get('id', f'line {n}')}: " + "; ".join(errs))
    unreviewed = sum(
        1 for raw in LABELS.read_text(encoding="utf-8").splitlines() if raw.strip() and not json.loads(raw).get("reviewed")
    )
    print(f"\n{total} records, {bad} with problems, {unreviewed} not yet human-reviewed.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
