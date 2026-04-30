-- Event article summary cache for the related-issues popup.
-- Apply in Supabase SQL Editor before enabling the popup API in production.

CREATE TABLE IF NOT EXISTS event_article_summaries (
    id          bigserial   PRIMARY KEY,
    event_id    bigint      NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    source_url  text,
    locale      text        NOT NULL CHECK (locale IN ('ko', 'en')),
    summary     text        NOT NULL,
    model       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_event_article_summaries_event_locale
    ON event_article_summaries (event_id, locale);

CREATE INDEX IF NOT EXISTS idx_event_article_summaries_created_at
    ON event_article_summaries (created_at DESC);

ALTER TABLE event_article_summaries ENABLE ROW LEVEL SECURITY;
-- Service-role only. The frontend reads/writes through the backend API.
