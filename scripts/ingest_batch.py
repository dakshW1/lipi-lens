"""Bulk-add a folder of raw phone photos to the dataset.

For each image: fix rotation -> pre-label with Lipi Lens (text + face/plate boxes) ->
blur faces/plates (never the text) -> save as JPEG -> append to dataset/labels.jsonl with reviewed=false.
Humans then correct the labels (faster than typing from scratch) and set
reviewed=true.

Usage (from repo root):
  backend/.venv/Scripts/python scripts/ingest_batch.py raw_photos/ --contributor team-07 --location "Mathikere, Bengaluru"

Only run this on photos where consent is covered (you took them, of public signage).
"""
from __future__ import annotations

import argparse
import json
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")

from app import dataset, ocr  # noqa: E402
from app.preprocess import MODEL_LONG_EDGE, load_image, resize_long_edge, to_jpeg_bytes  # noqa: E402
from app.privacy import blur_sensitive  # noqa: E402

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--contributor", default="team")
    ap.add_argument("--location", default="")
    ap.add_argument("--only", type=Path, help="text file with one image filename per line to process")
    ap.add_argument("--pace", type=float, default=4.0, help="seconds between model calls (free-tier friendly)")
    args = ap.parse_args()

    if ocr.is_demo_mode():
        sys.exit("No API key set: pre-labels would be fake demo data. Add GEMINI_API_KEY (free) to backend/.env.")

    # Optional manifest (written by fetch_commons.py) with per-image source, author, licence and GPS.
    manifest = {}
    man_path = args.folder / "manifest.jsonl"
    if man_path.exists():
        for line in man_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                m = json.loads(line)
                manifest[m["file"]] = m
        print(f"manifest: {len(manifest)} entries (source/licence/GPS will be kept)")

    already = {r.get("source_file") for r in dataset._read_all()}
    files = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in EXTS)
    if args.only:
        wanted = {ln.strip() for ln in args.only.read_text(encoding="utf-8").splitlines() if ln.strip()}
        files = [p for p in files if p.name in wanted]
    print(f"{len(files)} images")
    for p in files:
        key = f"{args.folder.name}/{p.name}"
        if key in already:
            continue
        img = load_image(p.read_bytes())
        if max(img.size) < dataset.MIN_LONG_EDGE:
            print(f"  skip {p.name}: {max(img.size)}px < {dataset.MIN_LONG_EDGE}px")
            continue
        try:
            raw = await ocr.read_sign_patient(to_jpeg_bytes(resize_long_edge(img, MODEL_LONG_EDGE)))
        except ocr.OCRError as e:
            print(f"  fail {p.name}: {e}")
            continue
        if not raw["lines"]:
            print(f"  skip {p.name}: no Kannada text found")
            continue
        # Blur faces/plates the model found (+ Haar faces), never inside the text lines.
        blurred, counts = blur_sensitive(
            img, extra=raw.get("sensitive"), protect=[ln["bbox"] for ln in raw["lines"] if len(ln["bbox"]) == 4]
        )
        m = manifest.get(p.name)
        extra = {"source_file": key}
        location, contributor = args.location, args.contributor
        if m:
            geo = m.get("geo")
            extra |= {
                "source": m["source"],
                "author": m.get("author"),
                "license": m["license"],
                "license_url": m.get("license_url"),
                "geo": geo,
            }
            contributor = "wikimedia-commons"
            if not location and geo:
                location = f"{geo['lat']:.5f}, {geo['lon']:.5f}"
        try:
            rec = await dataset.add_sample(
                blurred, raw["lines"], raw["category"], location, [], contributor, counts, extra
            )
        except ValueError as e:
            print(f"  skip {p.name}: {e}")
            continue
        print(f"  {rec['id']} <- {p.name} ({len(rec['lines'])} lines, {rec['category']}, blurred {counts})")
        await asyncio.sleep(args.pace)


if __name__ == "__main__":
    asyncio.run(main())
