import { supabase } from "@/lib/supabase";
import type { Event, MarketSnapshot, OilPriceSeries, StraitMetric } from "@/types";

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

export async function fetchRecentEvents(limit = 5): Promise<Event[]> {
  const { data } = await supabase
    .from("events")
    .select("id, event_date, event_type, title, summary, source_name, source_url, severity")
    .order("event_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}
