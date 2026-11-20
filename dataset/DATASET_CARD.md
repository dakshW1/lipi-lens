# Lipi Lens Kannada Signage Dataset · ಲಿಪಿ ಲೆನ್ಸ್

Real-world photos of Kannada signage from Karnataka (road and direction signs, railway station
boards, shop signs, government notices, posters), each labelled line by line with the exact
Kannada text in Unicode, ISO 15919 transliteration, English translation and a bounding box.

Built for **Modalapada 2.0** (Image track, Challenge 4) with the Lipi Lens app.
Release date: 2026-11-20

## At a glance

| | |
|---|---|
| Images | 133 |
| Labelled text lines | 794 |
| Human-reviewed images | 1 of 133 |
| Geotagged images | 131 |
| Images mixing Kannada and English | 78 |
| Faces / number plates blurred | 241 / 15 |

### Kind of sign

| Category | Images |
|---|---|
| Other signage | 82 |
| Government notice | 18 |
| Shop sign | 15 |
| Poster | 11 |
| Milestone / road sign | 7 |

### Source

| Contributor | Images |
|---|---|
| wikimedia-commons | 131 |
| daksh | 2 |

### Licences (per image; see ATTRIBUTION.csv)

| Licence | Images |
|---|---|
| CC BY-SA 4.0 | 80 |
| CC BY-SA 3.0 | 29 |
| CC BY 3.0 | 8 |
| CC BY 2.0 | 5 |
| CC BY-SA 2.0 | 4 |
| CC BY 4.0 | 4 |
| CC-BY-4.0 | 2 |
| CC0 | 1 |

## Files

```
images/lipi_XXXX.jpg   JPEG, long edge >= 1280 px, faces and plates blurred
labels.jsonl           one JSON record per image (UTF-8)
ATTRIBUTION.csv        author, licence and source link for every image
DATASET_CARD.md        this file
```

## Record format (labels.jsonl)

```json
{
  "id": "lipi_0001",
  "image": "images/lipi_0001.jpg",
  "category": "milestone",
  "location": "12.89051, 77.59799",
  "geo": {"lat": 12.89051, "lon": 77.59799},
  "lines": [
    {"kannada": "ಜಯದೇವ ಆಸ್ಪತ್ರೆ", "transliteration": "jayadēva āspatre",
      "translation": "Jayadeva Hospital", "bbox": [0.546, 0.811, 0.646, 0.843]}
  ],
  "script_mix": "kn+en",
  "reviewed": true,
  "license": "CC BY 3.0",
  "author": "...",
  "source": "https://commons.wikimedia.org/wiki/File:..."
}
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
