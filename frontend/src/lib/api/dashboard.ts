import { supabase } from "@/lib/supabase";
import type { Event, GasolinePrice, MarketSnapshot, OilPriceSeries, SituationSummary, StraitMetric, TransitRecord, TrumpPost } from "@/types";

export async function fetchLatestSummary(): Promise<SituationSummary | null> {
  const { data } = await supabase
    .from("situation_summaries")
    .select("id, summary_ko, summary_en, generated_at")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
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
  const symbols = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ"];
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

export async function fetchTransitSeries(days = 90): Promise<TransitRecord[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("chokepoint_transits")
    .select("transit_date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,capacity_total,capacity_tanker")
    .eq("portid", "chokepoint6")
    .gte("transit_date", since)
    .order("transit_date", { ascending: true });
  return data ?? [];
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
