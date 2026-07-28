-- ============================================================
-- 글로벌 확장 Phase 1 증분 마이그레이션
-- Supabase SQL Editor에서 실행
-- 실행일: 2026-07-28
-- ============================================================


-- 1. event_article_summaries locale CHECK 제약조건 14개 언어로 확장
-- 기존 CHECK (locale IN ('ko', 'en'))를 제거하고 14개 언어로 재설정한다.
-- 기존 데이터(ko, en)는 새 제약조건에 포함되므로 데이터 손실 없음.
ALTER TABLE public.event_article_summaries
  DROP CONSTRAINT IF EXISTS event_article_summaries_locale_check;

ALTER TABLE public.event_article_summaries
  ADD CONSTRAINT event_article_summaries_locale_check
  CHECK (locale IN (
    'ko', 'en', 'ar', 'fa', 'ja', 'es', 'tr',
    'de', 'fr', 'pt-BR', 'it', 'zh-CN', 'zh-TW', 'ru'
  ));


-- 2. situation_summary_translations 테이블 생성
-- ko/en 기본 요약은 situation_summaries에 저장되고,
-- 나머지 12개 언어 접속 시 온디맨드로 번역 후 이 테이블에 캐시한다.
CREATE TABLE IF NOT EXISTS public.situation_summary_translations (
    id                  bigserial   PRIMARY KEY,
    summary_id          bigint      NOT NULL REFERENCES public.situation_summaries (id) ON DELETE CASCADE,
    locale              text        NOT NULL CHECK (locale IN (
                            'ar', 'fa', 'ja', 'es', 'tr',
                            'de', 'fr', 'pt-BR', 'it', 'zh-CN', 'zh-TW', 'ru'
                        )),
    summary_text        text        NOT NULL,
    summary_structured  jsonb,
    model               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (summary_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_situation_trans_summary_locale
    ON public.situation_summary_translations (summary_id, locale);
CREATE INDEX IF NOT EXISTS idx_situation_trans_created_at
    ON public.situation_summary_translations (created_at DESC);


-- 3. RLS 활성화 및 공개 읽기 정책
ALTER TABLE public.situation_summary_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.situation_summary_translations
  FOR SELECT USING (true);


-- 4. Data API GRANT (2026 Supabase 보안 기준)
-- 프론트엔드 anon/authenticated: 공개 읽기
GRANT SELECT ON public.situation_summary_translations TO anon, authenticated;

-- 백엔드 service_role: 읽기/쓰기/삭제
GRANT SELECT, INSERT, UPDATE, DELETE ON public.situation_summary_translations TO service_role;

-- bigserial 시퀀스 USAGE
GRANT USAGE, SELECT ON SEQUENCE public.situation_summary_translations_id_seq TO service_role;
