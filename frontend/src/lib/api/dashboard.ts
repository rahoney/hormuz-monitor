import { supabase } from "@/lib/supabase";
import type { Event, GasolinePrice, MarketOHLCV, MarketSnapshot, OilPriceSeries, RiskScoreHistory, SituationSummary, StraitMetric, TransitRecord, TrumpPost, WeeklyTransitSummary, StatusLevel } from "@/types";

export async function fetchLatestSummary(): Promise<SituationSummary | null> {
  const { data } = await supabase
    .from("situation_summaries")
    .select("id, summary_ko, summary_en, generated_at, geo_score")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

export async function fetchRiskScoreHistory(): Promise<RiskScoreHistory[]> {
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("risk_score_history")
    .select("score_date, total_score, vessel_score, geo_score, brent_score, vix_score, geo_raw")
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
  const since = rows[rows.length - 1].transit_date;
  const { data: metrics } = await supabase
    .from("strait_metrics")
    .select("period_start,offshore_exit_count")
    .gte("period_start", `${since}T00:00:00+00:00`)
    .lte("period_start", `${latestDate}T23:59:59+00:00`);

  const metricMap = new Map(
    ((metrics ?? []) as { period_start: string; offshore_exit_count: number | null }[]).map((m) => [
      m.period_start.slice(0, 10),
      m.offshore_exit_count ?? null,
    ])
  );

  const outboundVals = rows
    .map((row) => metricMap.get(row.transit_date))
    .filter((v): v is number => typeof v === "number");
  const offshore = outboundVals.length > 0
    ? Math.round(outboundVals.reduce((sum, v) => sum + v, 0) / outboundVals.length)
    : null;
  const total = avg(rows as unknown as Record<string, unknown>[], "n_total");
  const inland = total != null && offshore != null ? Math.max(total - offshore, 0) : null;

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
  const symbols = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ", "ES_FUTURES", "NQ_FUTURES", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"];
  const result: Record<string, MarketSnapshot> = {};
  for (const symbol of symbols) {
    const { data } = await supabase
      .from("market_snapshots")
      .select("*")
      .eq("symbol", symbol)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();
    if (data) result[symbol] = data;
  }
  return result;
}

export async function fetchMarketIntraday(): Promise<Record<string, { time: string; price: number }[]>> {
  const since = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const symbols = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ", "ES_FUTURES", "NQ_FUTURES", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"];

  // 심볼별 병렬 쿼리 — 단일 쿼리 시 기본 1000행 limit에 걸려 선물 심볼이 결과를 독점하는 문제 방지
  const fetches = await Promise.all(
    symbols.map((symbol) =>
      supabase
        .from("market_intraday")
        .select("recorded_at, price")
        .eq("symbol", symbol)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .then(({ data }) => ({ symbol, rows: (data ?? []) as { recorded_at: string; price: number }[] }))
    )
  );

  const result: Record<string, { time: string; price: number }[]> = {};
  for (const { symbol, rows } of fetches) {
    result[symbol] = rows.map((r) => ({ time: r.recorded_at, price: r.price }));
  }
  return result;
}

export async function fetchMarketOHLCV(): Promise<Record<string, MarketOHLCV[]>> {
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
  const symbols = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ", "ES_FUTURES", "NQ_FUTURES", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"];
  const { data } = await supabase
    .from("market_ohlcv")
    .select("symbol, price_date, open, high, low, close")
    .in("symbol", symbols)
    .gte("price_date", since)
    .order("price_date", { ascending: true });

  const result: Record<string, MarketOHLCV[]> = {};
  for (const row of (data ?? []) as MarketOHLCV[]) {
    if (!result[row.symbol]) result[row.symbol] = [];
    result[row.symbol].push(row);
  }
  return result;
}

export async function fetchMarketHistory(days = 30): Promise<Record<string, { date: string; price: number }[]>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const symbols = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ", "ES_FUTURES", "NQ_FUTURES", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"];
  const { data } = await supabase
    .from("market_snapshots")
    .select("symbol, snapshot_date, price")
    .in("symbol", symbols)
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

export async function fetchRecentEvents(limit = 5): Promise<Event[]> {
  const { data } = await supabase
    .from("events")
    .select("id, event_date, published_at, event_type, title, summary, source_name, source_url, severity")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
