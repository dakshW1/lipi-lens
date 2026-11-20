# Tech Stack — Lipi Lens

The goal is the simplest stack that can ship in 3 days, works on a phone browser, and keeps the dataset and evaluation scripts in Python.

## Architecture

```
 Phone / laptop browser
 ┌───────────────────────────┐
 │  Frontend (Vite + React)  │  camera capture, upload, results UI, TTS
 └─────────────┬─────────────┘
               │  POST /api/read (multipart image)
 ┌─────────────▼─────────────┐
 │  Backend (FastAPI)        │
 │  1. preprocess (Pillow)   │  EXIF rotate, resize, encode
 │  2. OCR+translate (Gemini)│  vision model → JSON lines
 │  3. transliterate         │  indic-transliteration (deterministic)
 │  4. cache (by image hash) │
 └─────────────┬─────────────┘
               │  POST /api/contribute
 ┌─────────────▼─────────────┐
 │  Dataset store            │  blur faces/plates (OpenCV) → images/ + labels.jsonl
 └───────────────────────────┘
```

## Choices

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Vite + React + TypeScript, Tailwind CSS | Fast setup, good on mobile, easy camera access via `<input capture>` / `getUserMedia` |
| **Backend** | Python 3.11 + FastAPI + Uvicorn | Same language as the dataset and eval scripts. Async. Auto-generated API docs. |
| **OCR + translation** | Google Gemini API free tier (`gemini-3.5-flash-lite`, set `LIPI_MODEL=gemini-2.5-flash` for stronger reading) with JSON-schema output. Claude API (`claude-opus-5-5`) is a drop-in paid alternative via `LIPI_PROVIDER=anthropic`. | Reads Kannada scene text without training, structured JSON in one call, $0 on the free tier. |
| **Transliteration** | `indic-transliteration` (sanscript): Kannada → ISO 15919 / IAST, plus a simplified "readable" romanisation | Deterministic and consistent. Never invents text. |
| **Image processing** | Pillow (resize, EXIF), OpenCV (face detection + Gaussian blur) | Standard tools with no GPU needed |
| **Number-plate blur** | OpenCV Haar plate cascade, plus manual review | Good enough for a hackathon. Any misses are caught in the review pass. |
| **Text-to-speech** | Browser Web Speech API (`lang="kn-IN"`). Fall back to gTTS on the backend if the device has no Kannada voice. | Costs nothing |
| **Evaluation** | `jiwer` (CER/WER), plain Python script | One command gives the numbers for the slides |
| **Storage** | Local filesystem: `dataset/images/*.jpg` + `dataset/labels.jsonl` | Simple to version and easy to upload to Hugging Face / the hackathon dataset |
| **Dataset hosting** | Hugging Face Datasets (CC-BY-4.0) + a copy in the hackathon's submission | Standard, reusable, citable |
| **Deploy** | Frontend: Vercel. Backend: Render / Railway (free tier). | Gives a public HTTPS URL, which phone camera access requires |
| **Secrets** | `.env` with `GEMINI_API_KEY` (free) or `ANTHROPIC_API_KEY` (never committed) | |

## Repo layout

```
kr-ai-multimodal/
├── PRD.md
├── TECH_STACK.md
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes: /api/read, /api/contribute, /health
│   │   ├── ocr.py            # Gemini (free) / Claude vision call + JSON parsing
│   │   ├── transliterate.py  # indic-transliteration wrapper
│   │   ├── preprocess.py     # resize, EXIF, hash
│   │   └── privacy.py        # face/plate blur
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/ (App.tsx, components/Camera.tsx, components/ResultCard.tsx)
│   └── package.json
├── dataset/
│   ├── images/
│   ├── labels.jsonl
│   ├── splits/{dev,test}.txt
│   └── DATASET_CARD.md
└── scripts/
    ├── ingest_batch.py       # blur raw photos + pre-label with the model → dataset (reviewed=false)
    ├── validate_dataset.py   # check UTF-8, JPEG ≥1280px, consent, schema
    └── eval.py               # CER/WER on test split
```

## Key dependencies

**Backend (`requirements.txt`)**
```
fastapi
uvicorn[standard]
python-multipart
anthropic
pillow
opencv-python-headless
indic-transliteration
jiwer
python-dotenv
```

**Frontend**
```
react, react-dom, typescript, vite, tailwindcss
```

## API contract

`POST /api/read` → image file in, JSON out:

```json
{
  "lines": [
    {
      "kannada": "ಮೆಜೆಸ್ಟಿಕ್",
      "transliteration": "mejesṭik",
      "translation": "Majestic",
      "bbox": [120, 40, 610, 140],
      "confidence": 0.93
    }
  ],
  "category": "bus_board",
  "structured": { "route_no": "252", "destination": "ಮೆಜೆಸ್ಟಿಕ್" },
  "latency_ms": 3400
}
```

`POST /api/contribute`: an image plus corrected `lines` plus `consent: true`. The server blurs the image, then appends to `labels.jsonl`.

## Data format compliance (hackathon rules)
- Text: UTF-8 Kannada Unicode only. `validate_dataset.py` rejects text in legacy font encodings.
- Images: JPEG, long edge ≥1280 px
- Privacy: faces and plates blurred, personal details removed, consent recorded per sample
- Labels exactly match the text in the image (no corrections of spelling on signs)
