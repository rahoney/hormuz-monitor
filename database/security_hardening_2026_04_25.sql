-- Hormuz Monitor security hardening
-- Apply in Supabase SQL Editor after deployment.
--
-- Purpose:
-- - Keep internal run/error logs private.
-- - Keep raw AIS vessel positions private.
-- - Public UI continues to read aggregated/public tables:
--   strait_metrics, chokepoint_transits, oil_price_series, market_*,
--   gasoline_prices, events, trump_posts, situation_summaries, risk_score_history.

alter table public.vessels_normalized enable row level security;
drop policy if exists "public read" on public.vessels_normalized;

alter table public.source_runs enable row level security;
drop policy if exists "public read" on public.source_runs;

alter table public.source_errors enable row level security;
drop policy if exists "public read" on public.source_errors;
