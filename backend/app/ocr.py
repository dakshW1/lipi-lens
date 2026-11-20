"""Read Kannada scene text from an image with a vision model.

Two providers, picked automatically from backend/.env:
  - Gemini (free tier from Google AI Studio)  when GEMINI_API_KEY is set
  - Claude (Anthropic API, paid)              when ANTHROPIC_API_KEY is set
With neither key the app runs in demo mode. Force one with LIPI_PROVIDER=gemini|anthropic.

The model returns: Kannada lines (exactly as written), English translation,
approximate boxes, a confidence score and the sign category. Romanisation is
added afterwards by transliterate.py, never by the model.
"""
from __future__ import annotations

import asyncio
import base64
import copy
import json
import os


def _gemini_key() -> str | None:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def _anthropic_key() -> str | None:
    return os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")


def provider() -> str | None:
    forced = os.getenv("LIPI_PROVIDER", "").strip().lower()
    if forced in ("gemini", "anthropic"):
        return forced
    if _gemini_key():
        return "gemini"
    if _anthropic_key():
        return "anthropic"
    return None


# Free-tier Gemini: Flash-Lite has the most generous daily quota. Set LIPI_MODEL=gemini-2.5-flash
# for a stronger (but much more rate-limited) model.
_DEFAULT_MODEL = {"gemini": "gemini-3.5-flash-lite", "anthropic": "claude-opus-5-5"}
MODEL = os.getenv("LIPI_MODEL") or _DEFAULT_MODEL.get(provider() or "", "demo")
EFFORT = os.getenv("LIPI_EFFORT", "medium")

CATEGORIES = ["bus_board", "shop_sign", "milestone", "poster", "govt_notice", "other"]

SYSTEM_PROMPT = """You are Lipi Lens, an OCR and translation engine for Kannada text in photos of \
real-world signs in Karnataka (bus boards, shop signs, milestones, posters, government notices).

Rules:
- Transcribe ONLY text that is actually visible. Never guess, complete or "fix" words. If a word \
is partly hidden or blurry, transcribe what you can see and lower the confidence.
- Keep the Kannada exactly as written on the sign, including spelling mistakes, in Kannada Unicode.
- One entry per visual line of text, in reading order (top-to-bottom, left-to-right).
- Include only lines that contain Kannada script. Skip lines written only in English/Latin letters \
(on bilingual signs they just repeat the Kannada). Exception: a bus route number may be included as-is.
- `translation`: a natural English translation. For place names, give the common English \
spelling (e.g. ಮೆಜೆಸ್ಟಿಕ್ -> "Majestic", ಮಲ್ಲೇಶ್ವರಂ -> "Malleshwaram").
- `bbox`: [x_min, y_min, x_max, y_max] as fractions of image width/height (0 to 1). Approximate is fine.
- `confidence`: 0 to 1, how sure you are the transcription is exactly right.
- `category`: the kind of sign.
- For bus boards fill `structured` (route number, destination, via stops in Kannada). Otherwise \
leave its fields as empty strings / empty list.
- If there is no Kannada text at all, return an empty `lines` list.
- `sensitive`: a box for every human face and every vehicle number plate in the photo (any size, \
including people in the background), so they can be blurred for privacy. Never mark signboards, \
shop names or text panels as plates. Empty list if there are none."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "lines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kannada": {"type": "string"},
                    "translation": {"type": "string"},
                    "bbox": {"type": "array", "items": {"type": "number"}},
                    "confidence": {"type": "number"},
                },
                "required": ["kannada", "translation", "bbox", "confidence"],
                "additionalProperties": False,
            },
        },
        "category": {"type": "string", "enum": CATEGORIES},
        "sensitive": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["face", "plate"]},
                    "bbox": {"type": "array", "items": {"type": "number"}},
                },
                "required": ["kind", "bbox"],
                "additionalProperties": False,
            },
        },
        "structured": {
            "type": "object",
            "properties": {
                "route_no": {"type": "string"},
                "destination": {"type": "string"},
                "via": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["route_no", "destination", "via"],
            "additionalProperties": False,
        },
    },
    "required": ["lines", "category", "sensitive", "structured"],
    "additionalProperties": False,
}


class OCRError(Exception):
    """Readable error for the frontend."""


class RateLimited(OCRError):
    """Quota hit. Batch scripts wait and retry; the web UI just shows the message."""


def is_demo_mode() -> bool:
    return os.getenv("LIPI_DEMO", "0") == "1" or provider() is None


async def read_sign(jpeg_bytes: bytes) -> dict:
    """Send one JPEG to the active provider and return the parsed JSON result."""
    if is_demo_mode():
        return DEMO_RESULT
    if provider() == "gemini":
        return await _read_gemini(jpeg_bytes)
    return await _read_anthropic(jpeg_bytes)


async def read_sign_patient(jpeg_bytes: bytes, tries: int = 4) -> dict:
    """read_sign for batch scripts: on a rate limit, wait 30s, 60s, 90s and try again."""
    for attempt in range(tries):
        try:
            return await read_sign(jpeg_bytes)
        except RateLimited:
            if attempt == tries - 1:
                raise
            wait = 30 * (attempt + 1)
            print(f"    rate limited, waiting {wait}s...")
            await asyncio.sleep(wait)
    raise AssertionError("unreachable")


def _norm_box(b) -> list[float]:
    """[x0, y0, x1, y1] as 0-1 fractions, or [] if unusable. Accepts 0-1000 scale and swapped corners."""
    try:
        v = [float(x) for x in (b or [])][:4]
    except (TypeError, ValueError):
        return []
    if len(v) != 4:
        return []
    if max(v) > 1.5:  # 0-1000 scale
        v = [x / 1000 for x in v]
    v = [min(1.0, max(0.0, x)) for x in v]
    x0, x1 = sorted((v[0], v[2]))
    y0, y1 = sorted((v[1], v[3]))
    if x1 - x0 < 0.003 or y1 - y0 < 0.003:
        return []
    return [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)]


def _clean(raw: dict) -> dict:
    """Make the result safe for the rest of the app whatever the model returned."""
    lines = []
    for ln in raw.get("lines") or []:
        bbox = _norm_box(ln.get("bbox"))
        lines.append(
            {
                "kannada": str(ln.get("kannada", "")).strip(),
                "translation": str(ln.get("translation", "")).strip(),
                "bbox": bbox,
                "confidence": min(1.0, max(0.0, float(ln.get("confidence", 0.5)))),
            }
        )
    sensitive = []
    for sv in raw.get("sensitive") or []:
        bbox = _norm_box(sv.get("bbox"))
        if bbox and sv.get("kind") in ("face", "plate"):
            sensitive.append({"kind": sv["kind"], "bbox": bbox})
    st = raw.get("structured") or {}
    category = raw.get("category")
    return {
        "lines": [ln for ln in lines if ln["kannada"]],
        "sensitive": sensitive,
        "category": category if category in CATEGORIES else "other",
        "structured": {
            "route_no": str(st.get("route_no", "")),
            "destination": str(st.get("destination", "")),
            "via": [str(v) for v in st.get("via") or []],
        },
    }


# ---------------------------------------------------------------- Gemini (free tier)

_gemini_client = None


def _strip_additional_properties(schema):
    """Drop additionalProperties so the schema stays inside Gemini's supported subset."""
    if isinstance(schema, dict):
        return {k: _strip_additional_properties(v) for k, v in schema.items() if k != "additionalProperties"}
    if isinstance(schema, list):
        return [_strip_additional_properties(v) for v in schema]
    return schema


def _gemini_schema() -> dict:
    """Same schema, but boxes use Gemini's native `box_2d` ([ymin, xmin, ymax, xmax], 0-1000),
    which it produces far more reliably than other box formats."""
    sc = _strip_additional_properties(copy.deepcopy(OUTPUT_SCHEMA))
    for key in ("lines", "sensitive"):
        item = sc["properties"][key]["items"]
        item["properties"]["box_2d"] = item["properties"].pop("bbox")
        item["required"] = ["box_2d" if r == "bbox" else r for r in item["required"]]
    return sc


GEMINI_SCHEMA = _gemini_schema()
GEMINI_PROMPT = SYSTEM_PROMPT.replace("`bbox`: [x_min, y_min, x_max, y_max] as fractions of image width/height (0 to 1). Approximate is fine.",
    "`box_2d`: the bounding box as [ymin, xmin, ymax, xmax] normalized to 0-1000.")
GEMINI_PROMPT = GEMINI_PROMPT.replace("`sensitive`: a box", "`sensitive`: a `box_2d`")


def _from_box_2d(b) -> list[float]:
    try:
        y0, x0, y1, x1 = [float(v) for v in b][:4]
    except (TypeError, ValueError):
        return []
    return [x0 / 1000, y0 / 1000, x1 / 1000, y1 / 1000]


def _gemini_to_common(d: dict) -> dict:
    for key in ("lines", "sensitive"):
        for item in d.get(key) or []:
            if isinstance(item, dict):
                item["bbox"] = _from_box_2d(item.pop("box_2d", None) or [])
    return d


async def _read_gemini(jpeg_bytes: bytes) -> dict:
    global _gemini_client
    from google import genai
    from google.genai import errors, types

    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=_gemini_key())

    try:
        response = await _gemini_client.aio.models.generate_content(
            model=MODEL,
            contents=[
                types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                "Read all Kannada text in this photo.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=GEMINI_PROMPT,
                response_mime_type="application/json",
                response_json_schema=GEMINI_SCHEMA,
                temperature=0,
            ),
        )
    except errors.ClientError as e:
        msg = (e.message or str(e))[:300]
        if e.code == 429:
            raise RateLimited("Free-tier quota reached. Wait a minute and try again.") from e
        if e.code in (401, 403) or "API_KEY" in str(e) or "API key" in msg:
            raise OCRError("Invalid Gemini API key. Check GEMINI_API_KEY in backend/.env.") from e
        if e.code == 404:
            raise OCRError(f"Model '{MODEL}' not found. Set LIPI_MODEL in backend/.env.") from e
        raise OCRError(f"The API rejected the request: {msg}") from e
    except errors.ServerError as e:
        raise OCRError(f"Gemini server error ({e.code}). Try again.") from e
    except Exception as e:
        if isinstance(e, (OSError, asyncio.TimeoutError)) or type(e).__module__.startswith("httpx"):
            raise OCRError("Could not reach the Gemini API. Check your internet connection.") from e
        raise

    cand = (response.candidates or [None])[0]
    reason = str(getattr(cand, "finish_reason", "") or "")
    if any(r in reason for r in ("SAFETY", "PROHIBITED", "BLOCKLIST")):
        raise OCRError("The model declined to read this image.")
    if "MAX_TOKENS" in reason:
        raise OCRError("The response was cut off. Try a tighter crop of the sign.")
    text = response.text
    if not text:
        raise OCRError("The model returned no result.")
    try:
        return _clean(_gemini_to_common(json.loads(text)))
    except (json.JSONDecodeError, TypeError, ValueError, AttributeError) as e:
        raise OCRError("The model returned malformed output. Try again.") from e


# ---------------------------------------------------------------- Claude (paid)

_anthropic_client = None


async def _read_anthropic(jpeg_bytes: bytes) -> dict:
    global _anthropic_client
    import anthropic

    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic()

    image_b64 = base64.standard_b64encode(jpeg_bytes).decode("utf-8")
    try:
        response = await _anthropic_client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
            },
            # If a safety classifier declines, retry on a fallback model inside the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64},
                        },
                        {"type": "text", "text": "Read all Kannada text in this photo."},
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError as e:
        raise OCRError("Invalid Anthropic API key. Check backend/.env.") from e
    except anthropic.RateLimitError as e:
        raise RateLimited("Rate limited by the API. Wait a few seconds and try again.") from e
    except anthropic.BadRequestError as e:
        raise OCRError(f"The API rejected the request: {e.message}") from e
    except anthropic.APIStatusError as e:
        raise OCRError(f"API error ({e.status_code}). Try again.") from e
    except anthropic.APIConnectionError as e:
        raise OCRError("Could not reach the Anthropic API. Check your internet connection.") from e

    if response.stop_reason == "refusal":
        raise OCRError("The model declined to read this image.")
    if response.stop_reason == "max_tokens":
        raise OCRError("The response was cut off. Try a tighter crop of the sign.")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise OCRError("The model returned no result.")
    return _clean(json.loads(text))


DEMO_RESULT = {
    "lines": [
        {"kannada": "252", "translation": "Route 252", "bbox": [0.06, 0.18, 0.24, 0.42], "confidence": 0.97},
        {"kannada": "ಮೆಜೆಸ್ಟಿಕ್", "translation": "Majestic", "bbox": [0.28, 0.14, 0.92, 0.36], "confidence": 0.95},
        {
            "kannada": "ಮಲ್ಲೇಶ್ವರಂ ಮಾರ್ಗವಾಗಿ",
            "translation": "Via Malleshwaram",
            "bbox": [0.28, 0.40, 0.92, 0.58],
            "confidence": 0.88,
        },
    ],
    "category": "bus_board",
    "sensitive": [],
    "structured": {"route_no": "252", "destination": "ಮೆಜೆಸ್ಟಿಕ್", "via": ["ಮಲ್ಲೇಶ್ವರಂ"]},
}
