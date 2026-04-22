-- 미국 주유소 휘발유 가격 (EIA 주간 데이터)
CREATE TABLE IF NOT EXISTS gasoline_prices (
    id          bigserial PRIMARY KEY,
    area_code   text NOT NULL,           -- NUS, R1X, SCA, STX ... (EIA duoarea 코드)
    area_name   text NOT NULL,           -- "U.S.", "California", "Texas" ...
    area_type   text NOT NULL DEFAULT 'national', -- national | region | state
    price_date  date NOT NULL,
    price_usd   double precision NOT NULL, -- $/gallon
    source      text NOT NULL DEFAULT 'eia',
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (area_code, price_date)
);

CREATE INDEX IF NOT EXISTS idx_gasoline_area_date ON gasoline_prices (area_code, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_gasoline_date      ON gasoline_prices (price_date DESC);
