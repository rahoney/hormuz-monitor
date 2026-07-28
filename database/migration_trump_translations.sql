-- ============================================================
-- 트럼프 소셜 미디어 포스트 다국어 번역 캐시
-- ko/en 포스트는 trump_posts 테이블에 저장되고,
-- 나머지 12개 언어 접속 시 온디맨드로 번역 후 이 테이블에 캐시한다.
-- Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trump_post_translations (
    id                  bigserial   PRIMARY KEY,
    post_id             bigint      NOT NULL REFERENCES public.trump_posts (id) ON DELETE CASCADE,
    locale              text        NOT NULL CHECK (locale IN (
                            'ar', 'fa', 'ja', 'es', 'tr',
                            'de', 'fr', 'pt-BR', 'it', 'zh-CN', 'zh-TW', 'ru'
                        )),
    content_translated  text        NOT NULL,
    model               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (post_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_trump_trans_post_locale
    ON public.trump_post_translations (post_id, locale);

ALTER TABLE public.trump_post_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.trump_post_translations FOR SELECT USING (true);

GRANT SELECT ON public.trump_post_translations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trump_post_translations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trump_post_translations_id_seq TO service_role;
