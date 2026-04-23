-- situation_summaries에 지정학 점수 컬럼 추가
ALTER TABLE situation_summaries ADD COLUMN IF NOT EXISTS geo_score INTEGER;

-- 리스크 점수 이력 테이블
CREATE TABLE IF NOT EXISTS risk_score_history (
  score_date    DATE          PRIMARY KEY,
  total_score   NUMERIC(5,1)  NOT NULL,
  vessel_score  NUMERIC(5,1),
  geo_score     NUMERIC(5,1),
  brent_score   NUMERIC(5,1),
  vix_score     NUMERIC(5,1),
  geo_raw       INTEGER,
  updated_at    TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_risk_score_history"
  ON risk_score_history FOR SELECT TO anon USING (true);
