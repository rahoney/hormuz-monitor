export type StatusLevel = "normal" | "slightly_delayed" | "congested" | "high_risk" | "critical" | "blockade_level" | "unknown";
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

export interface WeeklyTransitSummary {
  status_level: StatusLevel;
  latest_date: string | null;
  total_vessels: number | null;
  tanker_vessels: number | null;
  container_vessels: number | null;
  dry_bulk_vessels: number | null;
  general_cargo_vessels: number | null;
  inland_entry_count: number | null;
  offshore_exit_count: number | null;
  source: string | null;
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
  source: "portwatch" | "aisstream_estimate" | string;
  offshore_exit_count?: number | null;
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

export interface SituationSummary {
  id: number;
  summary_ko: string;
  summary_en: string | null;
  generated_at: string;
  geo_score: number | null;
}

export interface MarketOHLCV {
  symbol: string;
  price_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketIntraday {
  symbol: string;
  recorded_at: string;
  price: number;
}

export interface RiskScoreHistory {
  score_date: string;
  total_score: number;
  vessel_score: number | null;
  geo_score: number | null;
  brent_score: number | null;
  vix_score: number | null;
  geo_raw: number | null;
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
