CREATE TABLE IF NOT EXISTS trump_posts (
    id          bigserial PRIMARY KEY,
    post_date   date NOT NULL,
    posted_at   timestamptz,
    content     text NOT NULL,
    source_url  text UNIQUE,
    source_name text NOT NULL DEFAULT 'Truth Social',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trump_posts_date ON trump_posts (post_date DESC);

CREATE POLICY "allow anon read trump_posts"
ON trump_posts FOR SELECT TO anon USING (true);
