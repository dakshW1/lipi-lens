"""Package the dataset for submission.

Writes dataset/DATASET_CARD.md and dataset/ATTRIBUTION.csv from labels.jsonl, then builds
lipi_lens_dataset.zip at the repo root (images + labels + card + attribution).

Usage (from repo root):
  backend/.venv/Scripts/python scripts/export_dataset.py
"""
from __future__ import annotations

import csv
import json
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT / "dataset"
LABELS = DS / "labels.jsonl"
ZIP = ROOT / "lipi_lens_dataset.zip"

CATEGORY_NAMES = {
    "bus_board": "Bus board", "shop_sign": "Shop sign", "milestone": "Milestone / road sign",
    "poster": "Poster", "govt_notice": "Government notice", "other": "Other signage",
}


def main() -> None:
    rows = [json.loads(line) for line in LABELS.read_text(encoding="utf-8").splitlines() if line.strip()]
    n = len(rows)
    n_lines = sum(len(r["lines"]) for r in rows)
    reviewed = sum(bool(r.get("reviewed")) for r in rows)
    geo = sum(bool(r.get("geo")) for r in rows)
    mixed = sum(r.get("script_mix") == "kn+en" for r in rows)
    cats = Counter(r["category"] for r in rows)
    lics = Counter(r.get("license", "") for r in rows)
    sources = Counter(r.get("contributor", "") for r in rows)
    faces = sum(r.get("auto_blurred", {}).get("face", 0) for r in rows)
    plates = sum(r.get("auto_blurred", {}).get("plate", 0) for r in rows)
    eval_path = ROOT / "eval_results.jsonl"

    with (DS / "ATTRIBUTION.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "image", "author", "license", "license_url", "source", "latitude", "longitude", "note"])
        for r in rows:
            g = r.get("geo") or {}
            w.writerow([
                r["id"], r["image"], r.get("author", r.get("contributor", "")), r.get("license", ""),
                r.get("license_url", ""), r.get("source", ""), g.get("lat", ""), g.get("lon", ""),
                "Modified: faces/number plates blurred, resized" if r.get("source") else "",
            ])

    cat_rows = "\n".join(f"| {CATEGORY_NAMES.get(c, c)} | {k} |" for c, k in cats.most_common())
    lic_rows = "\n".join(f"| {lic} | {k} |" for lic, k in lics.most_common())
    src_rows = "\n".join(f"| {s} | {k} |" for s, k in sources.most_common())

    card = f"""# Lipi Lens Kannada Signage Dataset · ಲಿಪಿ ಲೆನ್ಸ್

Real-world photos of Kannada signage from Karnataka (road and direction signs, railway station
boards, shop signs, government notices, posters), each labelled line by line with the exact
Kannada text in Unicode, ISO 15919 transliteration, English translation and a bounding box.

Built for **Modalapada 2.0** (Image track, Challenge 4) with the Lipi Lens app.
Release date: {date.today().isoformat()}

## At a glance

| | |
|---|---|
| Images | {n} |
| Labelled text lines | {n_lines} |
| Human-reviewed images | {reviewed} of {n} |
| Geotagged images | {geo} |
| Images mixing Kannada and English | {mixed} |
| Faces / number plates blurred | {faces} / {plates} |

### Kind of sign

| Category | Images |
|---|---|
{cat_rows}

### Source

| Contributor | Images |
|---|---|
{src_rows}

### Licences (per image; see ATTRIBUTION.csv)

| Licence | Images |
|---|---|
{lic_rows}

## Files

```
images/lipi_XXXX.jpg   JPEG, long edge >= 1280 px, faces and plates blurred
labels.jsonl           one JSON record per image (UTF-8)
ATTRIBUTION.csv        author, licence and source link for every image
DATASET_CARD.md        this file
```

## Record format (labels.jsonl)

```json
{{
  "id": "lipi_0001",
  "image": "images/lipi_0001.jpg",
  "category": "milestone",
  "location": "12.89051, 77.59799",
  "geo": {{"lat": 12.89051, "lon": 77.59799}},
  "lines": [
    {{"kannada": "ಜಯದೇವ ಆಸ್ಪತ್ರೆ", "transliteration": "jayadēva āspatre",
      "translation": "Jayadeva Hospital", "bbox": [0.546, 0.811, 0.646, 0.843]}}
  ],
  "script_mix": "kn+en",
  "reviewed": true,
  "license": "CC BY 3.0",
  "author": "...",
  "source": "https://commons.wikimedia.org/wiki/File:..."
}}
```

- `bbox` is `[x_min, y_min, x_max, y_max]` as fractions of image width and height.
- `transliteration` is generated deterministically (ISO 15919) from the Kannada text.
- `reviewed: false` means the label is a machine pre-label not yet checked by a person.

## How it was made

1. **Collection:** photos with a free licence (CC0, CC BY, CC BY-SA) were gathered from Wikimedia
   Commons categories about Kannada and Karnataka signage. Only JPEGs with a long edge of
   at least 1280 px were kept, preferring geotagged ones. Photos with no Kannada text were dropped.
2. **Pre-labelling:** each photo was read by a vision model (Google Gemini) that returns every
   line of Kannada exactly as written, an English translation and a bounding box.
3. **Privacy:** faces and vehicle number plates found by the model and by an OpenCV face
   detector were blurred before saving. Text regions are never blurred.
4. **Human review:** Kannada readers check each label against the photo, fix the text, meaning and
   category, and mark it reviewed. Photos with unreadable text or privacy problems are rejected.
5. **Validation:** `scripts/validate_dataset.py` checks the format, Kannada Unicode, image size and
   transliteration consistency.

New photos are added through the Lipi Lens **Contribute** page, which requires the
contributor's consent and blurs faces and plates automatically.

## Licence and attribution

Each image keeps the licence of its original photo (see `license` in each record and
`ATTRIBUTION.csv`). Images under CC BY-SA must be shared under the same licence. The blurred and
resized images are modifications of the originals. Labels (text, transliteration, translation,
boxes) are released under CC BY 4.0.

## Limitations

- Labels marked `reviewed: false` are machine output and may contain errors.
- Bounding boxes are approximate (one box per line).
- Wikimedia Commons over-represents Bengaluru and well-known places, and has few bus boards.
- Automatic blurring can miss very small or partly hidden faces.
"""
    if eval_path.exists():
        ev = [json.loads(line) for line in eval_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if ev:
            mean = sum(e["cer"] for e in ev) / len(ev)
            card += f"\n## Benchmark\n\nMean character error rate of Lipi Lens on {len(ev)} reviewed images: **{mean:.1%}**.\n"
    (DS / "DATASET_CARD.md").write_text(card, encoding="utf-8")

    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_STORED) as z:  # JPEGs don't compress further
        for name in ("labels.jsonl", "DATASET_CARD.md", "ATTRIBUTION.csv"):
            z.write(DS / name, f"lipi_lens_dataset/{name}")
        for r in rows:
            z.write(DS / r["image"], f"lipi_lens_dataset/{r['image']}")
    print(f"{n} images, {n_lines} lines, {reviewed} reviewed -> {ZIP} ({ZIP.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
