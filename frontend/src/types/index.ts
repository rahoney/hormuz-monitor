export type StatusLevel = "normal" | "restricted" | "high_risk" | "unknown";
export type DirectionStatus = "inland_entry" | "offshore_exit" | "stationary" | "unknown";
export type ZoneStatus = "inside_strait" | "persian_gulf_side" | "arabian_sea_side" | "unknown";

export interface StraitMetric {
  period_start: string;
  period_end: string;
  total_vessels: number;
  lng_vessels: number;
  crude_vessels: number;
  inland_entry_count: number;
  offshore_exit_count: number;
  status_level: StatusLevel;
}

export interface OilPriceSeries {
  symbol: string;
  price_date: string;
  price_usd: number;
  unit: string;
  source: string;
}

export interface MarketSnapshot {
  symbol: string;
  snapshot_date: string;
  price: number;
  change_pct: number | null;
  source: string;
}

export interface Event {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  severity: string | null;
}
