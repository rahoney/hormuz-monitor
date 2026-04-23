CREATE TABLE IF NOT EXISTS situation_summaries (
  id           bigserial PRIMARY KEY,
  summary_ko   text NOT NULL,
  summary_en   text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_situation_summaries_generated_at
  ON situation_summaries (generated_at DESC);

ALTER TABLE situation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow anon read situation_summaries"
  ON situation_summaries FOR SELECT TO anon USING (true);
