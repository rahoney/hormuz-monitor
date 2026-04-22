-- PortWatch IMF 일별 해협 통행량 테이블
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

-- RLS 공개 읽기
ALTER TABLE chokepoint_transits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON chokepoint_transits FOR SELECT USING (true);
