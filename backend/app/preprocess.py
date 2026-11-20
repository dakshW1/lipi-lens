"""Image loading, orientation fix, resizing and hashing."""
from __future__ import annotations

import hashlib
import io

from PIL import Image, ImageOps

# Long edge sent to the model. Claude downsizes beyond ~1568px anyway,
# so sending more only costs upload time.
MODEL_LONG_EDGE = 1568


def load_image(data: bytes) -> Image.Image:
    """Decode bytes, apply EXIF rotation (phone photos), force RGB."""
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def resize_long_edge(img: Image.Image, long_edge: int) -> Image.Image:
    w, h = img.size
    scale = long_edge / max(w, h)
    if scale >= 1:
        return img
    return img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def to_jpeg_bytes(img: Image.Image, quality: int = 90) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
