import { unstable_cache } from "next/cache";
import {
  fetchGasolinePrices,
  fetchLatestMarketSnapshots,
  fetchLatestStraitMetric,
  fetchLatestSummary,
  fetchMarketIntraday,
  fetchMarketOHLCV,
  fetchOilPriceSeries,
  fetchRecentEvents,
  fetchRiskScoreHistory,
  fetchTransitSeries,
  fetchTrumpPosts,
  fetchWeeklyTransitSummary,
} from "@/lib/api/dashboard";

const TTL = {
  summary: 93,
  market: 103,
  shipping: 425,
  riskAndTransitSummary: 513,
  events: 1636,
  trump: 3477,
  daily: 7269,
} as const;

export const getCachedLatestSummary = unstable_cache(
  fetchLatestSummary,
  ["dashboard", "latest-summary"],
  { revalidate: TTL.summary }
);

export const getCachedLatestMarketSnapshots = unstable_cache(
  fetchLatestMarketSnapshots,
  ["dashboard", "latest-market-snapshots"],
  { revalidate: TTL.market }
);

export const getCachedMarketIntraday = unstable_cache(
  fetchMarketIntraday,
  ["dashboard", "market-intraday"],
  { revalidate: TTL.market }
);

export const getCachedMarketOHLCV = unstable_cache(
  fetchMarketOHLCV,
  ["dashboard", "market-ohlcv"],
  { revalidate: TTL.market }
);

export const getCachedLatestStraitMetric = unstable_cache(
  fetchLatestStraitMetric,
  ["dashboard", "latest-strait-metric"],
  { revalidate: TTL.shipping }
);

export const getCachedTransitSeries = unstable_cache(
  fetchTransitSeries,
  ["dashboard", "transit-series"],
  { revalidate: TTL.shipping }
);

export const getCachedWeeklyTransitSummary = unstable_cache(
  fetchWeeklyTransitSummary,
  ["dashboard", "weekly-transit-summary"],
  { revalidate: TTL.riskAndTransitSummary }
);

export const getCachedRiskScoreHistory = unstable_cache(
  fetchRiskScoreHistory,
  ["dashboard", "risk-score-history"],
  { revalidate: TTL.riskAndTransitSummary }
);

export const getCachedRecentEvents = unstable_cache(
  fetchRecentEvents,
  ["dashboard", "recent-events"],
  { revalidate: TTL.events }
);

export const getCachedTrumpPosts = unstable_cache(
  fetchTrumpPosts,
  ["dashboard", "trump-posts"],
  { revalidate: TTL.trump }
);

export const getCachedOilPriceSeries = unstable_cache(
  fetchOilPriceSeries,
  ["dashboard", "oil-price-series"],
  { revalidate: TTL.daily }
);

export const getCachedGasolinePrices = unstable_cache(
  fetchGasolinePrices,
  ["dashboard", "gasoline-prices"],
  { revalidate: TTL.daily }
);
