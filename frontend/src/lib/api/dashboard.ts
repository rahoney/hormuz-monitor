import { supabase } from "@/lib/supabase";
import type { Event, GasolinePrice, MarketOHLCV, MarketSnapshot, OilPriceSeries, RiskScoreHistory, SituationSummary, StraitMetric, TransitRecord, TrumpPost, WeeklyTransitSummary, StatusLevel } from "@/types";

const MARKET_SYMBOLS = [
  "SP500", "NASDAQ", "ES_FUTURES", "NQ_FUTURES", "VIX",
  "KOSPI", "KOSDAQ", "STOXX600", "NIKKEI225", "HANG_SENG", "SHANGHAI",
  "US10Y", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"
];

export async function fetchLatestSummary(): Promise<SituationSummary | null> {
  const { data } = await supabase
    .from("situation_summaries")
    .select("id, summary_ko, summary_en, summary_ko_structured, summary_en_structured, generated_at, geo_score")
    .eq("is_published", true)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

export async function fetchLatestSummaryForLocale(locale: string): Promise<SituationSummary | null> {
  if (locale === "ko" || locale === "en") return fetchLatestSummary();

  const { data } = await supabase
    .from("situation_summaries")
    .select(`
      id,
      summary_ko,
      summary_en,
      summary_ko_structured,
      summary_en_structured,
      generated_at,
      geo_score,
      situation_summary_translations (
        locale,
        summary_text,
        summary_structured
      )
    `)
    .eq("is_published", true)
    .eq("situation_summary_translations.locale", locale)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  type TranslationRow = {
    locale: string;
    summary_text: string;
    summary_structured: SituationSummary["summary_translated_structured"];
  };
  type SummaryWithTranslations = SituationSummary & {
    situation_summary_translations: TranslationRow[] | null;
  };

  const row = data as SummaryWithTranslations;
  const translation = row.situation_summary_translations?.find(
    (item) => item.locale === locale
  );
  if (!translation) return null;

  return {
    id: row.id,
    summary_ko: row.summary_ko,
    summary_en: row.summary_en,
    summary_ko_structured: row.summary_ko_structured,
    summary_en_structured: row.summary_en_structured,
    generated_at: row.generated_at,
    geo_score: row.geo_score,
    summary_translated_text: translation.summary_text,
    summary_translated_structured: translation.summary_structured,
    locale_translated: locale,
  };
}

export async function fetchRiskScoreHistory(): Promise<RiskScoreHistory[]> {
  const since = new Date(Date.now() - 65 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("risk_score_history")
    .select("score_date, total_score, vessel_score, geo_score, brent_score, vix_score, geo_raw, vessels_raw, inland_entry_raw, offshore_exit_raw, brent_raw, brent_change_pct_7d_raw, vix_raw")
    .gte("score_date", since)
    .order("score_date", { ascending: false });
  return data ?? [];
}

export async function fetchLatestStraitMetric(): Promise<StraitMetric | null> {
  const { data } = await supabase
    .from("strait_metrics")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

function statusFromTransit(inland_entry: number | null, offshore_exit: number | null, total: number | null): StatusLevel {
  if (inland_entry === null && offshore_exit === null && total === null) return "unknown";
  
  const inlandScore = inland_entry !== null ? (1.0 - Math.min(inland_entry / 35.0, 1.0)) * 30.0 : 0.0;
  const offshoreScore = offshore_exit !== null ? (1.0 - Math.min(offshore_exit / 35.0, 1.0)) * 70.0 : 0.0;
  
  let riskScore = 0;
  if (inland_entry === null && offshore_exit === null && total !== null) {
      riskScore = (1.0 - Math.min(total / 70.0, 1.0)) * 100.0;
  } else {
      riskScore = inlandScore + offshoreScore;
  }

  if (riskScore <= 15) return "normal";
  if (riskScore <= 35) return "slightly_delayed";
  if (riskScore <= 55) return "congested";
  if (riskScore <= 75) return "high_risk";
  if (riskScore <= 90) return "critical";
  return "blockade_level";
}

function avg(rows: Record<string, unknown>[], key: string): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  return Math.round(total / rows.length);
}

export async function fetchWeeklyTransitSummary(): Promise<WeeklyTransitSummary | null> {
  const { data: transits } = await supabase
    .from("chokepoint_transits")
    .select("transit_date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,source")
    .eq("portid", "chokepoint6")
    .order("transit_date", { ascending: false })
    .limit(7);

  const rows = (transits ?? []) as TransitRecord[];
  if (rows.length === 0) return null;

  const latestDate = rows[0].transit_date;
  const { data: latestMetric } = await supabase
    .from("strait_metrics")
    .select("inland_entry_count,offshore_exit_count")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  const inland = latestMetric?.inland_entry_count ?? 0;
  const offshore = latestMetric?.offshore_exit_count ?? 0;
  const total = avg(rows as unknown as Record<string, unknown>[], "n_total");

  return {
    status_level: statusFromTransit(inland, offshore, total),
    latest_date: latestDate,
    total_vessels: total,
    tanker_vessels: avg(rows as unknown as Record<string, unknown>[], "n_tanker"),
    container_vessels: avg(rows as unknown as Record<string, unknown>[], "n_container"),
    dry_bulk_vessels: avg(rows as unknown as Record<string, unknown>[], "n_dry_bulk"),
    general_cargo_vessels: avg(rows as unknown as Record<string, unknown>[], "n_general_cargo"),
    offshore_exit_count: offshore,
    inland_entry_count: inland,
    source: rows[0].source ?? null,
  };
}

export async function fetchOilPriceSeries(
  symbols: string[],
  days = 90
): Promise<OilPriceSeries[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("oil_price_series")
    .select("symbol, price_date, price_usd, unit, source")
    .in("symbol", symbols)
    .gte("price_date", since)
    .order("price_date", { ascending: true });
  return data ?? [];
}

export async function fetchLatestOilPrices(): Promise<Record<string, OilPriceSeries>> {
  const symbols = ["WTI", "BRENT", "NATURAL_GAS"];
  const result: Record<string, OilPriceSeries> = {};
  for (const symbol of symbols) {
    const { data } = await supabase
      .from("oil_price_series")
      .select("*")
      .eq("symbol", symbol)
      .order("price_date", { ascending: false })
      .limit(1)
      .single();
    if (data) result[symbol] = data;
  }
  return result;
}

export async function fetchLatestMarketSnapshots(): Promise<Record<string, MarketSnapshot>> {
  const { data } = await supabase
    .from("market_snapshots")
    .select("symbol, snapshot_date, price, change_pct, source")
    .in("symbol", MARKET_SYMBOLS)
    .order("snapshot_date", { ascending: false })
    .limit(1000);

  const result: Record<string, MarketSnapshot> = {};
  for (const row of (data ?? []) as MarketSnapshot[]) {
    if (!result[row.symbol]) result[row.symbol] = row;
  }
  return result;
}

export async function fetchMarketIntraday(): Promise<Record<string, { time: string; price: number }[]>> {
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString();

  const fetches = await Promise.all(
    MARKET_SYMBOLS.map((symbol) =>
      supabase
        .from("market_intraday")
        .select("recorded_at, price")
        .eq("symbol", symbol)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(1000)
        .then(({ data }) => ({ symbol, rows: (data ?? []) as { recorded_at: string; price: number }[] }))
    )
  );

  const result: Record<string, { time: string; price: number }[]> = {};
  for (const { symbol, rows } of fetches) {
    result[symbol] = rows
      .slice()
      .reverse()
      .map((r) => ({ time: r.recorded_at, price: r.price }));
  }
  return result;
}

export async function fetchMarketOHLCV(): Promise<Record<string, MarketOHLCV[]>> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const result: Record<string, MarketOHLCV[]> = {};
  const fetches = await Promise.all(
    MARKET_SYMBOLS.map((symbol) =>
      supabase
        .from("market_ohlcv")
        .select("symbol, price_date, open, high, low, close")
        .eq("symbol", symbol)
        .gte("price_date", since)
        .order("price_date", { ascending: true })
        .then(({ data }) => ({ symbol, rows: (data ?? []) as MarketOHLCV[] }))
    )
  );
  for (const { symbol, rows } of fetches) {
    result[symbol] = rows;
  }
  return result;
}

export async function fetchMarketHistory(days = 30): Promise<Record<string, { date: string; price: number }[]>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("market_snapshots")
    .select("symbol, snapshot_date, price")
    .in("symbol", MARKET_SYMBOLS)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  const result: Record<string, { date: string; price: number }[]> = {};
  for (const row of data ?? []) {
    if (!result[row.symbol]) result[row.symbol] = [];
    result[row.symbol].push({ date: row.snapshot_date, price: row.price });
  }
  return result;
}

export async function fetchTransitSeries(days = 90): Promise<TransitRecord[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("chokepoint_transits")
    .select("transit_date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,capacity_total,capacity_tanker,source")
    .eq("portid", "chokepoint6")
    .gte("transit_date", since)
    .order("transit_date", { ascending: true });

  const rows = (data ?? []) as TransitRecord[];
  const { data: metrics } = await supabase
    .from("strait_metrics")
    .select("period_start,offshore_exit_count")
    .gte("period_start", `${since}T00:00:00+00:00`)
    .order("period_start", { ascending: true });
  const offshoreMap = new Map(
    ((metrics ?? []) as { period_start: string; offshore_exit_count: number | null }[]).map((m) => [
      m.period_start.slice(0, 10),
      m.offshore_exit_count,
    ])
  );

  return rows.map((row) => ({
    ...row,
    offshore_exit_count: offshoreMap.get(row.transit_date) ?? null,
  }));
}

export async function fetchGasolinePrices(days = 90): Promise<GasolinePrice[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("gasoline_prices")
    .select("area_code, area_name, area_type, price_date, price_usd")
    .gte("price_date", since)
    .order("price_date", { ascending: true });
  return data ?? [];
}

export async function fetchTrumpPosts(limit = 20): Promise<TrumpPost[]> {
  const { data } = await supabase
    .from("trump_posts")
    .select("id, post_date, posted_at, content, content_ko, source_url, source_name")
    .order("post_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchTrumpPostsForLocale(locale: string, limit = 20): Promise<TrumpPost[]> {
  const posts = await fetchTrumpPosts(limit);
  if (posts.length === 0 || locale === "ko" || locale === "en") return posts;

  const { data: translations } = await supabase
    .from("trump_post_translations")
    .select("post_id, content_translated")
    .eq("locale", locale)
    .in("post_id", posts.map((post) => post.id));

  const translatedById = new Map(
    ((translations ?? []) as { post_id: number; content_translated: string }[])
      .map((row) => [row.post_id, row.content_translated])
  );
  return posts.map((post) => ({
    ...post,
    content_translated: translatedById.get(post.id) ?? null,
    locale_translated: translatedById.has(post.id) ? locale : null,
  }));
}

export async function fetchRecentEvents(limit = 5): Promise<Event[]> {
  const { data } = await supabase
    .from("events")
    .select("id, event_date, published_at, event_type, title, summary, source_name, source_url, severity")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
