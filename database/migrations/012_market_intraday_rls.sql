-- market_intraday 공개 읽기 RLS 정책
ALTER TABLE market_intraday ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON market_intraday FOR SELECT USING (true);
