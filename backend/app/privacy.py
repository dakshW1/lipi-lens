"""Blur faces and number plates before anything is saved to the dataset (PRD F6).

Two sources of boxes:
  - `extra`: face/plate boxes from the vision model (it reads the photo anyway and finds small
    and background faces that Haar cascades miss)
  - OpenCV Haar face cascades as a second net
Text lines are protected: a Haar detection that overlaps a text box is ignored, so the blur can
never wipe out the sign being labelled. (The Haar plate cascade was dropped: it fires on
signboards.) A manual review pass still follows.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

_FACE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_PROFILE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

Box = tuple[int, int, int, int]  # x0, y0, x1, y1 in pixels


def _haar_faces(gray: np.ndarray) -> list[Box]:
    h, w = gray.shape
    min_side = max(24, min(h, w) // 40)
    out: list[Box] = []
    for cascade in (_FACE, _PROFILE):
        for x, y, bw, bh in cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(min_side, min_side)):
            out.append((int(x), int(y), int(x + bw), int(y + bh)))
    return out


def _to_px(b: list[float], w: int, h: int, pad: float = 0.0) -> Box:
    x0, y0, x1, y1 = b
    return (int(max(0, x0 - pad) * w), int(max(0, y0 - pad) * h), int(min(1, x1 + pad) * w), int(min(1, y1 + pad) * h))


def _overlap(a: Box, b: Box) -> float:
    """Fraction of a's area covered by b."""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = max(1, (a[2] - a[0]) * (a[3] - a[1]))
    return ix * iy / area


def blur_sensitive(
    img: Image.Image,
    extra: list[dict] | None = None,
    protect: list[list[float]] | None = None,
) -> tuple[Image.Image, dict[str, int]]:
    """Return a blurred copy and counts of what was blurred.

    extra:   [{"kind": "face"|"plate", "bbox": [x0,y0,x1,y1] fractions}] from the model
    protect: text-line bboxes (fractions) that Haar detections must not touch
    """
    arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    H, W = arr.shape[:2]
    gray = cv2.equalizeHist(cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY))
    text = [_to_px(b, W, H, pad=0.01) for b in (protect or []) if len(b) == 4]

    regions: list[tuple[str, Box]] = []
    for e in extra or []:
        bx = _to_px(e["bbox"], W, H)
        # Model boxes are trusted, but a "plate" sitting mostly on a text line is a misfire.
        if e["kind"] == "plate" and any(_overlap(bx, t) > 0.5 for t in text):
            continue
        regions.append((e["kind"], bx))
    for bx in _haar_faces(gray):
        if any(_overlap(bx, t) > 0.05 for t in text):
            continue
        if any(_overlap(bx, r) > 0.3 for _, r in regions):
            continue  # already covered by a model box
        regions.append(("face", bx))

    counts = {"face": 0, "plate": 0}
    for kind, (x0, y0, x1, y1) in regions:
        bw, bh = x1 - x0, y1 - y0
        if bw < 4 or bh < 4:
            continue
        pad = int(0.15 * max(bw, bh))
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
        k = max(31, (max(bw, bh) // 2) | 1)  # odd kernel, scales with region
        arr[y0:y1, x0:x1] = cv2.GaussianBlur(arr[y0:y1, x0:x1], (k, k), 0)
        counts[kind] += 1
    return Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)), counts
