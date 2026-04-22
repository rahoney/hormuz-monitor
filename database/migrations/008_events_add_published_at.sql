ALTER TABLE events ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_events_published_at ON events (published_at DESC NULLS LAST);
