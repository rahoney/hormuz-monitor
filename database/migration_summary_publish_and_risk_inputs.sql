-- 다국어 상황 요약의 원자적 게시와 위험지수 원시 입력값 1년 보관

ALTER TABLE public.situation_summaries
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- 기존 행도 12개 번역이 모두 존재하는 경우에만 게시 상태로 둔다.
UPDATE public.situation_summaries AS summary
SET is_published = (
  SELECT count(*) = 12
  FROM public.situation_summary_translations AS translation
  WHERE translation.summary_id = summary.id
);

CREATE INDEX IF NOT EXISTS idx_situation_summaries_published_generated
  ON public.situation_summaries (is_published, generated_at DESC);

ALTER TABLE public.situation_summaries
  ALTER COLUMN is_published SET DEFAULT false;

ALTER TABLE public.risk_score_history
  ADD COLUMN IF NOT EXISTS vessels_raw integer,
  ADD COLUMN IF NOT EXISTS inland_entry_raw integer,
  ADD COLUMN IF NOT EXISTS offshore_exit_raw integer,
  ADD COLUMN IF NOT EXISTS brent_raw double precision,
  ADD COLUMN IF NOT EXISTS brent_change_pct_7d_raw double precision,
  ADD COLUMN IF NOT EXISTS vix_raw double precision;
