"""Measure OCR accuracy (CER / WER) on the reviewed dataset.

  backend/.venv/Scripts/python scripts/eval.py            # test split (default)
  backend/.venv/Scripts/python scripts/eval.py --split dev

Split is deterministic by id hash: ~20% test, ~80% dev. Tune prompts on dev,
report test once at the end (PRD §7). Only human-reviewed records are scored.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "backend" / ".env")

import jiwer  # noqa: E402

from app import ocr  # noqa: E402
from app.dataset import DATASET_DIR, LABELS  # noqa: E402
from app.preprocess import MODEL_LONG_EDGE, load_image, resize_long_edge, to_jpeg_bytes  # noqa: E402


def split_of(sample_id: str) -> str:
    return "test" if int(hashlib.md5(sample_id.encode()).hexdigest(), 16) % 5 == 0 else "dev"


def norm(lines: list[str]) -> str:
    text = " ".join(" ".join(lines).split())
    return unicodedata.normalize("NFC", text)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["dev", "test", "all"], default="test")
    ap.add_argument("--include-unreviewed", action="store_true")
    ap.add_argument("--out", type=Path, default=ROOT / "eval_results.jsonl")
    args = ap.parse_args()

    if ocr.is_demo_mode():
        sys.exit("No API key set: evaluation needs the real model. Add GEMINI_API_KEY (free) to backend/.env.")

    recs = [json.loads(line) for line in LABELS.read_text(encoding="utf-8").splitlines() if line.strip()]
    recs = [r for r in recs if args.include_unreviewed or r.get("reviewed")]
    if args.split != "all":
        recs = [r for r in recs if split_of(r["id"]) == args.split]
    if not recs:
        sys.exit("No records to evaluate (are any marked reviewed=true?).")

    refs, hyps = [], []
    with args.out.open("w", encoding="utf-8") as out:
        for r in recs:
            img = load_image((DATASET_DIR / r["image"]).read_bytes())
            pred = await ocr.read_sign_patient(to_jpeg_bytes(resize_long_edge(img, MODEL_LONG_EDGE)))
            ref = norm([ln["kannada"] for ln in r["lines"]])
            hyp = norm([ln["kannada"] for ln in pred["lines"]])
            cer = jiwer.cer(ref, hyp) if ref else 0.0
            refs.append(ref)
            hyps.append(hyp)
            out.write(json.dumps({"id": r["id"], "ref": ref, "hyp": hyp, "cer": cer}, ensure_ascii=False) + "\n")
            print(f"{r['id']}  CER {cer:6.1%}")

    print(f"\n{args.split} split · {len(recs)} images")
    print(f"CER {jiwer.cer(refs, hyps):.1%}   WER {jiwer.wer(refs, hyps):.1%}   (target CER <= 15%)")
    print(f"Per-image results: {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
