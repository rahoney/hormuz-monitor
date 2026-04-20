-- Hormuz Monitor 초기 스키마
-- Supabase 대시보드 → SQL Editor에서 실행

-- ============================================================
-- 선박 데이터
-- ============================================================
CREATE TABLE IF NOT EXISTS vessels_normalized (
    id              bigserial PRIMARY KEY,
    mmsi            text          NOT NULL,
    ship_name       text,
    ship_type_code  int,
    ship_type_label text,                        -- tanker, lng_tanker, crude_tanker, other, unknown
    lat             double precision NOT NULL,
    lng             double precision NOT NULL,
    speed_knots     real,
    course_deg      real,
    heading_deg     real,
    zone_status     text NOT NULL DEFAULT 'unknown',   -- inside_strait | persian_gulf_side | arabian_sea_side | unknown
    direction_status text NOT NULL DEFAULT 'unknown',  -- inland_entry | offshore_exit | stationary | unknown
    source          text NOT NULL DEFAULT 'aisstream',
    raw_timestamp   timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessels_mmsi         ON vessels_normalized (mmsi);
CREATE INDEX IF NOT EXISTS idx_vessels_raw_timestamp ON vessels_normalized (raw_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vessels_zone_status   ON vessels_normalized (zone_status);

-- ============================================================
-- 해협 통행 집계 지표
-- ============================================================
CREATE TABLE IF NOT EXISTS strait_metrics (
    id                  bigserial PRIMARY KEY,
    period_start        timestamptz NOT NULL,
    period_end          timestamptz NOT NULL,
    total_vessels       int NOT NULL DEFAULT 0,
    lng_vessels         int NOT NULL DEFAULT 0,
    crude_vessels       int NOT NULL DEFAULT 0,
    inland_entry_count  int NOT NULL DEFAULT 0,
    offshore_exit_count int NOT NULL DEFAULT 0,
    status_level        text NOT NULL DEFAULT 'unknown',  -- normal | restricted | high_risk | unknown
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_strait_metrics_period ON strait_metrics (period_start DESC);

-- ============================================================
-- 유가 시계열 (EIA: WTI/BRENT/NATURAL_GAS + oilpriceapi bulk)
-- ============================================================
CREATE TABLE IF NOT EXISTS oil_price_series (
    id          bigserial PRIMARY KEY,
    symbol      text NOT NULL,          -- WTI | BRENT | NATURAL_GAS | DUBAI_CRUDE
    price_date  date NOT NULL,
    price_usd   double precision NOT NULL,
    unit        text NOT NULL,          -- USD/bbl | USD/MMBtu
    source      text NOT NULL,          -- eia | oilpriceapi
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (symbol, price_date)
);

CREATE INDEX IF NOT EXISTS idx_oil_price_symbol_date ON oil_price_series (symbol, price_date DESC);

-- ============================================================
-- 시장 지표 스냅샷 (yfinance: VIX/NASDAQ/SP500, pykrx: KOSPI/KOSDAQ)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_snapshots (
    id            bigserial PRIMARY KEY,
    symbol        text NOT NULL,        -- VIX | NASDAQ | SP500 | KOSPI | KOSDAQ
    snapshot_date date NOT NULL,
    price         double precision NOT NULL,
    change_pct    real,                 -- 전일 대비 변동률 (%)
    source        text NOT NULL,        -- yfinance | pykrx
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (symbol, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_market_symbol_date ON market_snapshots (symbol, snapshot_date DESC);

-- ============================================================
-- 지정학적 이벤트
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id           bigserial PRIMARY KEY,
    event_date   date NOT NULL,
    event_type   text NOT NULL,         -- closure | reopening | reclosure | ceasefire | negotiation | attack | sanctions | escort_operation
    title        text NOT NULL,
    summary      text,
    source_name  text,
    source_url   text,
    is_manual    boolean NOT NULL DEFAULT false,
    severity     text,                  -- low | medium | high
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date      ON events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_type      ON events (event_type);

-- ============================================================
-- 차트용 이벤트 마커
-- ============================================================
CREATE TABLE IF NOT EXISTS event_timeline_markers (
    id           bigserial PRIMARY KEY,
    event_id     bigint NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    marker_date  date NOT NULL,
    label        text NOT NULL,         -- 차트에 표시할 짧은 라벨
    chart_target text NOT NULL,         -- transit | oil | all
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_markers_date         ON event_timeline_markers (marker_date DESC);
CREATE INDEX IF NOT EXISTS idx_markers_chart_target ON event_timeline_markers (chart_target);

-- ============================================================
-- 수집 실행 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS source_runs (
    id              bigserial PRIMARY KEY,
    source_name     text NOT NULL,      -- eia_oil | aisstream | yfinance | pykrx | rss_events | oilpriceapi
    run_start       timestamptz NOT NULL,
    run_end         timestamptz,
    status          text NOT NULL DEFAULT 'running',  -- running | success | partial | failed
    records_fetched int NOT NULL DEFAULT 0,
    records_saved   int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_runs_name  ON source_runs (source_name, run_start DESC);
CREATE INDEX IF NOT EXISTS idx_source_runs_start ON source_runs (run_start DESC);

-- ============================================================
-- 수집 오류 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS source_errors (
    id            bigserial PRIMARY KEY,
    source_name   text NOT NULL,
    error_type    text NOT NULL,        -- network | parse | validate | save | unknown
    error_message text NOT NULL,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    run_id        bigint REFERENCES source_runs (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_errors_source ON source_errors (source_name, occurred_at DESC);
