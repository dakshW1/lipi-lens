"""Deterministic Kannada -> Latin transliteration.

The LLM never produces romanisation; we derive it from the Kannada Unicode
so the same text always romanises the same way (PRD F3).
"""
from __future__ import annotations

import re
import unicodedata

from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

KANNADA_START, KANNADA_END = 0x0C80, 0x0CFF


def has_kannada(text: str) -> bool:
    return any(KANNADA_START <= ord(ch) <= KANNADA_END for ch in text)


def to_iso(text: str) -> str:
    """ISO 15919 romanisation, e.g. ಮಲ್ಲೇಶ್ವರಂ -> mallēśvaraṁ."""
    if not has_kannada(text):
        return text
    return transliterate(text, sanscript.KANNADA, sanscript.ISO)


def to_simple(text: str) -> str:
    """ASCII-friendly romanisation for casual readers: mallēśvaraṁ -> mallesvaram."""
    iso = to_iso(text).replace("ṃ", "ṁ")
    # Anusvara is pronounced as the nasal of the following consonant: ಬೆಂಗಳೂರು -> bengaluru.
    iso = re.sub(r"ṁ(?=[pbm])", "m", iso)
    iso = re.sub(r"ṁ(?=[kgcjṭḍtdnsśṣhyrlvḷ])", "n", iso)
    iso = iso.replace("ṁ", "m").replace("ś", "sh").replace("ṣ", "sh")
    decomposed = unicodedata.normalize("NFD", iso)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))
