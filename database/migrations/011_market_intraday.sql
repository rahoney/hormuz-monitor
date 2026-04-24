-- 시장 지표 5분봉 데이터 테이블
CREATE TABLE IF NOT EXISTS market_intraday (
    id          bigserial PRIMARY KEY,
    symbol      text NOT NULL,
    recorded_at timestamptz NOT NULL,
    price       double precision NOT NULL,
    source      text NOT NULL DEFAULT 'yfinance',
    UNIQUE (symbol, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_market_intraday_sym_time
    ON market_intraday (symbol, recorded_at DESC);
