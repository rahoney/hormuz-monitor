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
