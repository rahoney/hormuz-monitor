-- ============================================================
-- Hormuz Monitor — 최종 통합 스키마
-- (migrations/001~013 통합본, Supabase SQL Editor에서 실행)
-- ============================================================


-- ============================================================
-- 선박 데이터
-- ============================================================
CREATE TABLE IF NOT EXISTS vessels_normalized (
    id               bigserial PRIMARY KEY,
    mmsi             text             NOT NULL,
    ship_name        text,
    ship_type_code   int,
    ship_type_label  text,                           -- tanker | lng_tanker | crude_tanker | other | unknown
    lat              double precision NOT NULL,
    lng              double precision NOT NULL,
    speed_knots      real,
    course_deg       real,
    heading_deg      real,
    zone_status      text NOT NULL DEFAULT 'unknown',      -- inside_strait | persian_gulf_side | arabian_sea_side | unknown
    direction_status text NOT NULL DEFAULT 'unknown',      -- inland_entry | offshore_exit | stationary | unknown
    source           text NOT NULL DEFAULT 'aisstream',
    raw_timestamp    timestamptz NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessels_mmsi          ON vessels_normalized (mmsi);
CREATE INDEX IF NOT EXISTS idx_vessels_raw_timestamp ON vessels_normalized (raw_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vessels_zone_status   ON vessels_normalized (zone_status);

ALTER TABLE vessels_normalized ENABLE ROW LEVEL SECURITY;
-- Raw AIS rows are service-only. Public UI reads aggregated transit tables instead.


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
    status_level        text NOT NULL DEFAULT 'unknown',   -- normal | restricted | high_risk | unknown
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_strait_metrics_period ON strait_metrics (period_start DESC);

ALTER TABLE strait_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON strait_metrics FOR SELECT USING (true);


-- ============================================================
-- PortWatch IMF 일별 해협 통행량
-- ============================================================
CREATE TABLE IF NOT EXISTS chokepoint_transits (
    id              bigserial PRIMARY KEY,
    portid          text NOT NULL,
    portname        text NOT NULL,
    transit_date    date NOT NULL,
    n_total         int NOT NULL DEFAULT 0,
    n_tanker        int NOT NULL DEFAULT 0,
    n_container     int NOT NULL DEFAULT 0,
    n_dry_bulk      int NOT NULL DEFAULT 0,
    n_general_cargo int NOT NULL DEFAULT 0,
    capacity_total  double precision,
    capacity_tanker double precision,
    source          text NOT NULL DEFAULT 'portwatch',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (portid, transit_date)
);

CREATE INDEX IF NOT EXISTS idx_transit_portid_date ON chokepoint_transits (portid, transit_date DESC);

ALTER TABLE chokepoint_transits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON chokepoint_transits FOR SELECT USING (true);


-- ============================================================
-- 유가 시계열 (EIA: WTI/BRENT/NATURAL_GAS + oilpriceapi bulk)
-- ============================================================
CREATE TABLE IF NOT EXISTS oil_price_series (
    id         bigserial PRIMARY KEY,
    symbol     text             NOT NULL,   -- WTI | BRENT | NATURAL_GAS | DUBAI_CRUDE
    price_date date             NOT NULL,
    price_usd  double precision NOT NULL,
    unit       text             NOT NULL,   -- USD/bbl | USD/MMBtu
    source     text             NOT NULL,   -- eia | oilpriceapi
    created_at timestamptz      NOT NULL DEFAULT now(),
    UNIQUE (symbol, price_date)
);

CREATE INDEX IF NOT EXISTS idx_oil_price_symbol_date ON oil_price_series (symbol, price_date DESC);

ALTER TABLE oil_price_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON oil_price_series FOR SELECT USING (true);


-- ============================================================
-- 미국 주유소 휘발유 가격 (EIA 주간)
-- ============================================================
CREATE TABLE IF NOT EXISTS gasoline_prices (
    id         bigserial        PRIMARY KEY,
    area_code  text             NOT NULL,   -- NUS | R1X | SCA | STX ... (EIA duoarea 코드)
    area_name  text             NOT NULL,   -- "U.S." | "California" | "Texas" ...
    area_type  text             NOT NULL DEFAULT 'national',  -- national | region | state
    price_date date             NOT NULL,
    price_usd  double precision NOT NULL,   -- $/gallon
    source     text             NOT NULL DEFAULT 'eia',
    created_at timestamptz      NOT NULL DEFAULT now(),
    UNIQUE (area_code, price_date)
);

CREATE INDEX IF NOT EXISTS idx_gasoline_area_date ON gasoline_prices (area_code, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_gasoline_date      ON gasoline_prices (price_date DESC);

ALTER TABLE gasoline_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON gasoline_prices FOR SELECT USING (true);


-- ============================================================
-- 시장 지표 일별 스냅샷 (yfinance)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_snapshots (
    id            bigserial        PRIMARY KEY,
    symbol        text             NOT NULL,   -- VIX | NASDAQ | SP500 | KOSPI | KOSDAQ | ES_FUTURES | NQ_FUTURES
    snapshot_date date             NOT NULL,
    price         double precision NOT NULL,
    change_pct    real,                        -- 전일 대비 변동률 (%)
    source        text             NOT NULL,   -- yfinance
    created_at    timestamptz      NOT NULL DEFAULT now(),
    UNIQUE (symbol, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_market_symbol_date ON market_snapshots (symbol, snapshot_date DESC);

ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON market_snapshots FOR SELECT USING (true);


-- ============================================================
-- 시장 지표 5분봉 인트라데이
-- ============================================================
CREATE TABLE IF NOT EXISTS market_intraday (
    id          bigserial        PRIMARY KEY,
    symbol      text             NOT NULL,
    recorded_at timestamptz      NOT NULL,
    price       double precision NOT NULL,
    source      text             NOT NULL DEFAULT 'yfinance',
    UNIQUE (symbol, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_market_intraday_sym_time ON market_intraday (symbol, recorded_at DESC);

ALTER TABLE market_intraday ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON market_intraday FOR SELECT USING (true);


-- ============================================================
-- 시장 지표 일봉 OHLCV
-- ============================================================
CREATE TABLE IF NOT EXISTS market_ohlcv (
    id         bigserial        PRIMARY KEY,
    symbol     text             NOT NULL,
    price_date date             NOT NULL,
    open       double precision NOT NULL,
    high       double precision NOT NULL,
    low        double precision NOT NULL,
    close      double precision NOT NULL,
    source     text             NOT NULL DEFAULT 'yfinance',
    UNIQUE (symbol, price_date)
);

CREATE INDEX IF NOT EXISTS idx_market_ohlcv_sym_date ON market_ohlcv (symbol, price_date DESC);

ALTER TABLE market_ohlcv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON market_ohlcv FOR SELECT USING (true);


-- ============================================================
-- 지정학적 이벤트 (+ published_at from 008)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id           bigserial   PRIMARY KEY,
    event_date   date        NOT NULL,
    event_type   text        NOT NULL,   -- closure | reopening | reclosure | ceasefire | negotiation | attack | sanctions | escort_operation
    title        text        NOT NULL,
    summary      text,
    source_name  text,
    source_url   text,
    published_at timestamptz,
    is_manual    boolean     NOT NULL DEFAULT false,
    severity     text,                  -- low | medium | high
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON events FOR SELECT USING (true);


-- ============================================================
-- 관련 이슈 기사 요약 캐시
-- ============================================================
CREATE TABLE IF NOT EXISTS event_article_summaries (
    id          bigserial   PRIMARY KEY,
    event_id    bigint      NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    source_url  text,
    locale      text        NOT NULL CHECK (locale IN ('ko', 'en')),
    summary     text        NOT NULL,
    model       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_event_article_summaries_event_locale
    ON event_article_summaries (event_id, locale);
CREATE INDEX IF NOT EXISTS idx_event_article_summaries_created_at
    ON event_article_summaries (created_at DESC);

ALTER TABLE event_article_summaries ENABLE ROW LEVEL SECURITY;
-- Service-role only. Public UI reads through backend API.


-- ============================================================
-- 차트용 이벤트 마커
-- ============================================================
CREATE TABLE IF NOT EXISTS event_timeline_markers (
    id           bigserial   PRIMARY KEY,
    event_id     bigint      NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    marker_date  date        NOT NULL,
    label        text        NOT NULL,   -- 차트에 표시할 짧은 라벨
    chart_target text        NOT NULL,   -- transit | oil | all
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_markers_date         ON event_timeline_markers (marker_date DESC);
CREATE INDEX IF NOT EXISTS idx_markers_chart_target ON event_timeline_markers (chart_target);

ALTER TABLE event_timeline_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON event_timeline_markers FOR SELECT USING (true);


-- ============================================================
-- 트럼프 소셜 미디어 포스트 (+ content_ko from 007)
-- ============================================================
CREATE TABLE IF NOT EXISTS trump_posts (
    id          bigserial   PRIMARY KEY,
    post_date   date        NOT NULL,
    posted_at   timestamptz,
    content     text        NOT NULL,
    content_ko  text,
    source_url  text        UNIQUE,
    source_name text        NOT NULL DEFAULT 'Truth Social',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trump_posts_date ON trump_posts (post_date DESC);

ALTER TABLE trump_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON trump_posts FOR SELECT USING (true);


-- ============================================================
-- 상황 요약 (AI 생성, + geo_score from 010)
-- ============================================================
CREATE TABLE IF NOT EXISTS situation_summaries (
    id           bigserial   PRIMARY KEY,
    summary_ko   text        NOT NULL,
    summary_en   text,
    geo_score    integer,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_situation_summaries_generated_at ON situation_summaries (generated_at DESC);

ALTER TABLE situation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON situation_summaries FOR SELECT USING (true);


-- ============================================================
-- 위험 지수 이력
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_score_history (
    score_date   date         PRIMARY KEY,
    total_score  numeric(5,1) NOT NULL,
    vessel_score numeric(5,1),
    geo_score    numeric(5,1),
    brent_score  numeric(5,1),
    vix_score    numeric(5,1),
    geo_raw      integer,
    updated_at   timestamptz  DEFAULT now()
);

ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON risk_score_history FOR SELECT USING (true);


-- ============================================================
-- 수집 실행 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS source_runs (
    id              bigserial   PRIMARY KEY,
    source_name     text        NOT NULL,   -- eia_oil | aisstream | yfinance | rss_events | oilpriceapi
    run_start       timestamptz NOT NULL,
    run_end         timestamptz,
    status          text        NOT NULL DEFAULT 'running',  -- running | success | partial | failed
    records_fetched int         NOT NULL DEFAULT 0,
    records_saved   int         NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_runs_name  ON source_runs (source_name, run_start DESC);
CREATE INDEX IF NOT EXISTS idx_source_runs_start ON source_runs (run_start DESC);

ALTER TABLE source_runs ENABLE ROW LEVEL SECURITY;
-- Internal run logs are service-only.


-- ============================================================
-- 수집 오류 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS source_errors (
    id            bigserial   PRIMARY KEY,
    source_name   text        NOT NULL,
    error_type    text        NOT NULL,   -- network | parse | validate | save | unknown
    error_message text        NOT NULL,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    run_id        bigint      REFERENCES source_runs (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_errors_source ON source_errors (source_name, occurred_at DESC);

ALTER TABLE source_errors ENABLE ROW LEVEL SECURITY;
-- Internal error logs are service-only.
