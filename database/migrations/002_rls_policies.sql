-- 공개 읽기 RLS 정책 (대시보드 anon key 접근 허용)
alter table strait_metrics         enable row level security;
alter table oil_price_series       enable row level security;
alter table market_snapshots       enable row level security;
alter table events                 enable row level security;
alter table event_timeline_markers enable row level security;
alter table vessels_normalized     enable row level security;
alter table source_runs            enable row level security;
alter table source_errors          enable row level security;

create policy "public read" on strait_metrics         for select using (true);
create policy "public read" on oil_price_series       for select using (true);
create policy "public read" on market_snapshots       for select using (true);
create policy "public read" on events                 for select using (true);
create policy "public read" on event_timeline_markers for select using (true);
create policy "public read" on vessels_normalized     for select using (true);
