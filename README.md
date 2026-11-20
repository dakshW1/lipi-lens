# Lipi Lens · ಲಿಪಿ ಲೆನ್ಸ್

Point a phone at a Kannada sign → get the Kannada text, an English transliteration and a translation.
Built for **Modalapada 2.0** (Image track, Challenge 4). See [PRD.md](PRD.md) and [TECH_STACK.md](TECH_STACK.md).

## Run it locally (Windows)

**1. Backend** (Python 3.11+)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # then paste a free GEMINI_API_KEY (https://aistudio.google.com/apikey)
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The free Gemini tier is rate-limited (Flash-Lite is the default because it has the biggest daily quota); batch scripts wait and retry automatically. Results are cached per photo. Without any key the backend runs in **demo mode** and returns a sample bus-board result, so the UI still works.

> On this machine Windows Smart App Control blocks some unsigned binaries. That's why
> requirements pin `numpy==2.5.3` and why we run `python -m uvicorn` instead of `uvicorn.exe`.

**2. Frontend** (Node 20+)

```powershell
cd frontend
npm install
npm run dev                      # http://localhost:5173 (proxies /api to :8000)
```

To test on your phone, open `http://<your-laptop-ip>:5173` on the same Wi-Fi. Camera capture on a
phone needs HTTPS, except on localhost, so for the live demo deploy it or use a tunnel.

**Single-server mode:** run `npm run build` in `frontend/`. The backend then serves `frontend/dist` at `http://localhost:8000`.

## Features

- **Read**: camera, upload, drag-and-drop or **Try a sample** (a generated bus-board photo, handy for
  demos) → animated scan → each line of Kannada with ISO 15919 transliteration, a "say it" romanisation,
  English translation, a confidence meter, its box on the photo (hover to match), read-aloud and copy.
  Bus boards get a route card.
- **Contribute**: a 4-step flow (photo → text → details → consent) with Lipi Lens pre-fill, live
  romanisation preview and auto-blur of faces and plates → saved to `dataset/`.
- **Dataset**: progress ring toward 150 images, KPI tiles, collected-per-day chart against the needed pace,
  sign-type and photo-condition bars, contributor leaderboard and latest thumbnails.
- Light and dark themes (follows the device; toggle in the rail), smooth scrolling (Lenis) and `motion`
  animations, all off when the device asks for reduced motion.

Design language matches Kilometre, Clausewise and Approvals: warm paper ground, borderless cards, night cards
for headline numbers, Bricolage Grotesque, Manrope and Instrument Serif, plus Noto Sans Kannada.

## Dataset workflow

```powershell
# bulk-add a folder of your own photos (blur + pre-label, marked reviewed=false)
backend\.venv\Scripts\python scripts\ingest_batch.py raw_photos --contributor team-07 --location "Mathikere, Bengaluru"

# after a human corrects labels and sets "reviewed": true in dataset/labels.jsonl
backend\.venv\Scripts\python scripts\validate_dataset.py   # hackathon format rules
backend\.venv\Scripts\python scripts\eval.py --split dev   # tune on dev
backend\.venv\Scripts\python scripts\eval.py               # final CER/WER on test
```

Output: `dataset/images/*.jpg` + `dataset/labels.jsonl` (UTF-8 Kannada Unicode, CC-BY-4.0).

## Layout

```
backend/app/   main.py (API) · ocr.py (Gemini / Claude vision) · transliterate.py · privacy.py · dataset.py · preprocess.py
frontend/src/  App.tsx · pages/{Read,Contribute,Dataset}Page.tsx · components/
scripts/       ingest_batch.py · validate_dataset.py · eval.py
```
