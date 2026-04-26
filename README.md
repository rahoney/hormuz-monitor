# Hormuz Monitor

## Installation

### Frontend

Frontend dependencies are managed with npm in `frontend/package.json` and `frontend/package-lock.json`.

```bash
cd frontend
npm install
npm run dev
```

For reproducible CI or deployment installs, use:

```bash
cd frontend
npm ci
npm run build
```

Required frontend environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_DEFAULT_LOCALE=
```

### Backend

Backend dependencies are managed in `backend/requirements.txt`.

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload
```

Required backend environment variables:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
EIA_API_KEY=
AISSTREAM_API_KEY=
GOOGLE_GEMINI_API_KEY=
```

Optional Gemini fallback override variables:

```env
GEMINI_SUMMARY_MODELS=gemini-3.1-flash-lite-preview,gemini-3-flash-preview,gemini-2.5-flash,gemma-3-27b-it
GEMINI_TRANSLATION_MODELS=gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemma-3-27b-it
```

### Gemini Troubleshooting

If Gemini returns `503 UNAVAILABLE`, `429 RESOURCE_EXHAUSTED`, `500 INTERNAL`,
`504 DEADLINE_EXCEEDED`, or a network timeout, the backend retries the same model
with exponential backoff and then falls back to the next configured model.

Default summary model order:

```text
gemini-3.1-flash-lite-preview
gemini-3-flash-preview
gemini-2.5-flash
gemma-3-27b-it
```

Default Trump post translation model order:

```text
gemini-3.1-flash-lite-preview
gemini-2.5-flash
gemma-3-27b-it
```

Notes from testing:

- `gemini-3-flash-preview` works through REST `generateContent`.
- `gemini-3-flash-preview` is not a Live API WebSocket model.
- `gemini-3.1-flash-live-preview` can complete Live API setup, but it is not a
  drop-in replacement for REST summary or translation jobs.
- Very small `maxOutputTokens` can produce empty `gemini-3-flash-preview`
  responses because thinking tokens may consume the output budget.
- Gemma models can add explanations unless prompts and post-processing are strict;
  `gemma-3-27b-it` behaved better than `gemma-4-31b-it` for translation tests.

### Backend Jobs

Run collector jobs from the `backend` directory:

```bash
python -m jobs.oil_ingest
python -m jobs.market_ingest
python -m jobs.events_ingest
python -m jobs.portwatch_ingest
python -m jobs.shipping_ingest
python -m jobs.summary_rebuild
```

Render uses `rootDir: backend` and installs Python dependencies with:

```bash
pip install -r requirements.txt
```
