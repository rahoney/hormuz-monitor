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

export interface TransitRecord {
  transit_date: string;
  n_total: number;
  n_tanker: number;
  n_container: number;
  n_dry_bulk: number;
  n_general_cargo: number;
  capacity_total: number | null;
  capacity_tanker: number | null;
}

export interface TrumpPost {
  id: number;
  post_date: string;
  posted_at: string | null;
  content: string;
  content_ko: string | null;
  source_url: string | null;
  source_name: string;
}

export interface GasolinePrice {
  area_code: string;
  area_name: string;
  area_type: string;
  price_date: string;
  price_usd: number;
}

export interface Event {
  id: number;
  event_date: string;
  published_at: string | null;
  event_type: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  severity: string | null;
}
