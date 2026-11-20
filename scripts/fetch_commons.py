"""Fetch real, freely licensed photos of Kannada signage from Wikimedia Commons.

Walks sign-related categories, keeps JPEG photos that are large enough and carry a
free licence (CC0 / public domain / CC BY / CC BY-SA), prefers geotagged ones, and
downloads a 1920px rendition plus a manifest with author, licence, source and GPS.

Usage (from repo root):
  backend/.venv/Scripts/python scripts/fetch_commons.py --max 200
Output:
  raw_photos/commons/*.jpg + raw_photos/commons/manifest.jsonl
Then:
  backend/.venv/Scripts/python scripts/ingest_batch.py raw_photos/commons
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "LipiLensDatasetFetcher/0.1 (student hackathon research; open Kannada sign dataset)"}
THUMB_WIDTH = 1920  # a standard Wikimedia thumbnail bucket
MIN_LONG_EDGE = 1280

# category -> hint for the sign type (the model decides the final category)
SEEDS = {
    "Category:Kannada-language signs": "other",
    "Category:Kannada-language signs in India": "other",
    "Category:Kannada-language street signs": "shop_sign",
    "Category:Signs in Karnataka": "other",
    "Category:Multilingual signs in Karnataka": "other",
    "Category:Bilingual Kannada-Tamil signs": "other",
    "Category:Bilingual Kannada-Urdu signs": "other",
    "Category:Road signs in Karnataka": "milestone",
    "Category:Road signs in Bengaluru": "milestone",
    "Category:Welcome signs in Karnataka": "other",
    "Category:Park signs in Karnataka": "govt_notice",
    "Category:Kannada-language posters": "poster",
    "Category:Posters in Kannada": "poster",
}
SKIP_CATEGORY = re.compile(r"film poster|inscription|vowel|font|character|script|logo|map", re.I)
FREE = re.compile(r"^(cc0|public domain|pd|cc[- ]by(-sa)?[- ]?\d)", re.I)


def api(s: requests.Session, **params) -> dict:
    params |= {"format": "json", "formatversion": 2}
    for attempt in range(6):
        time.sleep(1.0)  # be polite: Commons rate-limits anonymous API clients
        r = s.get(API, params=params, timeout=40)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After", 0) or 0) or 10 * (attempt + 1)
            print(f"    API busy, waiting {wait}s")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    r.raise_for_status()
    return {}


def walk(s: requests.Session, depth: int) -> dict[str, str]:
    """Return {file title: sign-type hint} for files in the seed categories (and subcategories)."""
    files: dict[str, str] = {}
    seen: set[str] = set()
    frontier = list(SEEDS.items())
    for level in range(depth + 1):
        nxt = []
        for cat, hint in frontier:
            if cat in seen:
                continue
            seen.add(cat)
            cont: dict = {}
            while True:
                d = api(s, action="query", list="categorymembers", cmtitle=cat, cmtype="file|subcat",
                        cmlimit=500, **cont)
                for m in d.get("query", {}).get("categorymembers", []):
                    if m["ns"] == 6:
                        files.setdefault(m["title"], hint)
                    elif m["ns"] == 14 and level < depth and not SKIP_CATEGORY.search(m["title"]):
                        nxt.append((m["title"], hint))
                if "continue" not in d:
                    break
                cont = {k: v for k, v in d["continue"].items() if k != "continue"}
        frontier = nxt
        print(f"  level {level}: {len(seen)} categories, {len(files)} files")
    return files


def strip_html(x: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", x or "")).strip()


def details(s: requests.Session, titles: list[str]) -> list[dict]:
    out = []
    for i in range(0, len(titles), 50):
        d = api(s, action="query", titles="|".join(titles[i:i + 50]), prop="imageinfo|coordinates",
                iiprop="url|size|mime|extmetadata", iiurlwidth=THUMB_WIDTH, colimit="max")
        for p in d.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [None])[0]
            if not ii or ii.get("mime") != "image/jpeg":
                continue
            md = ii.get("extmetadata", {})
            lic = md.get("LicenseShortName", {}).get("value", "")
            if not FREE.search(lic.strip()):
                continue
            w, h = ii["width"], ii["height"]
            scale = min(1.0, THUMB_WIDTH / w)
            if max(w, h) * scale < MIN_LONG_EDGE:
                continue
            co = (p.get("coordinates") or [None])[0]
            gps_lat = md.get("GPSLatitude", {}).get("value")
            gps_lon = md.get("GPSLongitude", {}).get("value")
            geo = {"lat": co["lat"], "lon": co["lon"]} if co else (
                {"lat": float(gps_lat), "lon": float(gps_lon)} if gps_lat and gps_lon else None)
            out.append({
                "title": p["title"],
                "download": ii.get("thumburl") or ii["url"],
                "source": ii["descriptionurl"],
                "author": strip_html(md.get("Artist", {}).get("value", ""))[:200],
                "license": lic.strip(),
                "license_url": md.get("LicenseUrl", {}).get("value", ""),
                "description": strip_html(md.get("ImageDescription", {}).get("value", ""))[:300],
                "taken": strip_html(md.get("DateTimeOriginal", {}).get("value", ""))[:40],
                "geo": geo,
                "size": [w, h],
            })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=200)
    ap.add_argument("--depth", type=int, default=2)
    ap.add_argument("--out", type=Path, default=ROOT / "raw_photos" / "commons")
    args = ap.parse_args()

    s = requests.Session()
    s.headers.update(UA)
    print("Walking categories...")
    files = walk(s, args.depth)
    print(f"Fetching metadata for {len(files)} files...")
    cands = details(s, list(files))
    for c in cands:
        c["hint"] = files[c["title"]]
    cands.sort(key=lambda c: c["geo"] is None)  # geotagged first
    print(f"{len(cands)} usable (free licence, JPEG, >= {MIN_LONG_EDGE}px); "
          f"{sum(c['geo'] is not None for c in cands)} geotagged")

    args.out.mkdir(parents=True, exist_ok=True)
    man_path = args.out / "manifest.jsonl"
    done = {}
    if man_path.exists():
        for line in man_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                done[r["title"]] = r
    with man_path.open("a", encoding="utf-8") as man:
        n = len(done)
        for c in cands:
            if n >= args.max:
                break
            if c["title"] in done:
                continue
            name = f"commons_{n + 1:04d}.jpg"
            for attempt in range(6):
                r = s.get(c["download"], timeout=60)
                if r.status_code == 429:
                    wait = int(r.headers.get("Retry-After", 0) or 0) or 10 * (attempt + 1)
                    print(f"    busy, waiting {wait}s")
                    time.sleep(wait)
                    continue
                break
            if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
                print(f"  skip {c['title']}: HTTP {r.status_code}")
                continue
            (args.out / name).write_bytes(r.content)
            c["file"] = name
            man.write(json.dumps(c, ensure_ascii=False) + "\n")
            man.flush()
            n += 1
            print(f"  {name} <- {c['title'][5:60]}  {'GPS' if c['geo'] else '   '}  {c['license']}")
            time.sleep(1.0)
    print(f"Done: {n} images in {args.out}")


if __name__ == "__main__":
    main()
