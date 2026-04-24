-- 시장 지표 일봉 OHLCV 테이블
CREATE TABLE IF NOT EXISTS market_ohlcv (
    id         bigserial PRIMARY KEY,
    symbol     text NOT NULL,
    price_date date NOT NULL,
    open       double precision NOT NULL,
    high       double precision NOT NULL,
    low        double precision NOT NULL,
    close      double precision NOT NULL,
    source     text NOT NULL DEFAULT 'yfinance',
    UNIQUE (symbol, price_date)
);

CREATE INDEX IF NOT EXISTS idx_market_ohlcv_sym_date
    ON market_ohlcv (symbol, price_date DESC);

ALTER TABLE market_ohlcv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON market_ohlcv FOR SELECT USING (true);
