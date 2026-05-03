export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";
import Card from "@/components/ui/Card";
import CurrentStatusCards from "@/components/cards/CurrentStatusCards";
import TradingViewChart from "@/components/charts/TradingViewChart";
import TransitCombinedChart from "@/components/charts/TransitCombinedChart";
import MarketSnapshotCards from "@/components/cards/MarketSnapshotCards";
import RecentEventsList from "@/components/cards/RecentEventsList";
import StraitMapPanel from "@/components/map/StraitMapPanel";
import HormuzRiskGauge from "@/components/cards/HormuzRiskGauge";
import SharePageButton from "@/components/cards/SharePageButton";
import GasolinePricesPanel from "@/components/charts/GasolinePricesPanel";
import TrumpPostsFeed from "@/components/cards/TrumpPostsFeed";
import SituationSummaryCard from "@/components/cards/SituationSummaryCard";
import SectionJumpSelect from "@/components/navigation/SectionJumpSelect";
import MobileSectionNav from "@/components/navigation/MobileSectionNav";
import {
  getCachedGasolinePrices,
  getCachedLatestMarketSnapshots,
  getCachedLatestStraitMetric,
  getCachedLatestSummary,
  getCachedMarketIntraday,
  getCachedMarketOHLCV,
  getCachedOilPriceSeries,
  getCachedRecentEvents,
  getCachedRiskScoreHistory,
  getCachedTransitSeries,
  getCachedTrumpPosts,
  getCachedWeeklyTransitSummary,
} from "@/lib/api/dashboard-cache";

function brentChangePct7d(oilData: { symbol: string; price_date: string; price_usd: number }[]): number | null {
  const brentRows = oilData
    .filter((r) => r.symbol === "BRENT")
    .sort((a, b) => b.price_date.localeCompare(a.price_date));
  const latest = brentRows[0];
  if (!latest) return null;

  const targetTime = new Date(latest.price_date).getTime() - 7 * 86_400_000;
  const base = brentRows.find((row) => new Date(row.price_date).getTime() <= targetTime);
  if (!base || base.price_usd === 0) return null;
  return ((latest.price_usd - base.price_usd) / base.price_usd) * 100;
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const sections = [
    { id: "summary", label: t("sections.summary") },
    { id: "risk", label: t("gauge.title") },
    { id: "weekly-transit", label: t("sections.weeklyTransit") },
    { id: "map", label: t("sections.map") },
    { id: "transit-flow", label: t("sections.transitFlow") },
    { id: "oil", label: t("sections.oilRealtime") },
    { id: "gasoline", label: t("gasoline.title") },
    { id: "market", label: t("sections.marketSnapshot") },
    { id: "events", label: t("sections.recentEvents") },
    { id: "trump", label: t("trump.title") },
  ];

  const [metric, weeklyTransit, oilSeries, marketSnapshots, marketIntradayResult, marketOHLCVResult, recentEvents, transitSeries, gasolineSeries, trumpPosts, summaryResult, riskHistoryResult] = await Promise.allSettled([
    getCachedLatestStraitMetric(),
    getCachedWeeklyTransitSummary(),
    getCachedOilPriceSeries(["WTI", "BRENT", "NATURAL_GAS"], 90),
    getCachedLatestMarketSnapshots(),
    getCachedMarketIntraday(),
    getCachedMarketOHLCV(),
    getCachedRecentEvents(15),
    getCachedTransitSeries(90),
    getCachedGasolinePrices(90),
    getCachedTrumpPosts(20),
    getCachedLatestSummary(),
    getCachedRiskScoreHistory(),
  ]);

  const metricData      = metric.status              === "fulfilled" ? metric.value              : null;
  const weeklyTransitData = weeklyTransit.status     === "fulfilled" ? weeklyTransit.value       : null;
  const oilData         = oilSeries.status           === "fulfilled" ? oilSeries.value           : [];
  const marketData      = marketSnapshots.status     === "fulfilled" ? marketSnapshots.value     : {};
  const marketHistory   = marketIntradayResult.status === "fulfilled" ? marketIntradayResult.value : {};
  const marketOHLCV     = marketOHLCVResult.status    === "fulfilled" ? marketOHLCVResult.value    : {};
  const eventsData      = recentEvents.status        === "fulfilled" ? recentEvents.value        : [];
  const transitData     = transitSeries.status       === "fulfilled" ? transitSeries.value       : [];
  const gasolineData    = gasolineSeries.status      === "fulfilled" ? gasolineSeries.value      : [];
  const trumpData       = trumpPosts.status          === "fulfilled" ? trumpPosts.value          : [];
  const summaryData     = summaryResult.status       === "fulfilled" ? summaryResult.value       : null;
  const riskHistory     = riskHistoryResult.status   === "fulfilled" ? riskHistoryResult.value   : [];

  const latestBrent = oilData
    .filter((r) => r.symbol === "BRENT")
    .sort((a, b) => b.price_date.localeCompare(a.price_date))[0]?.price_usd ?? null;
  const latestBrentChangePct7d = brentChangePct7d(oilData);
  const latestVix = (marketData as Record<string, { price: number }>)["VIX"]?.price ?? null;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <MobileSectionNav sections={sections} />

        {/* 페이지 헤더 */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
            <SharePageButton />
          </div>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        <SectionJumpSelect label={t("sections.jump")} sections={sections} />

        {/* 상황 요약 */}
        <section id="summary" className="scroll-mt-32">
          <SituationSummaryCard summary={summaryData} />
        </section>

        {/* 호르무즈 위험 지수 게이지 */}
        <Card title={t("gauge.title")} className="scroll-mt-32" id="risk">
          <HormuzRiskGauge
            vessels={weeklyTransitData?.total_vessels ?? metricData?.total_vessels ?? null}
            inlandEntry={weeklyTransitData?.inland_entry_count ?? metricData?.inland_entry_count ?? null}
            offshoreExit={weeklyTransitData?.offshore_exit_count ?? metricData?.offshore_exit_count ?? null}
            brent={latestBrent}
            brentChangePct7d={latestBrentChangePct7d}
            vix={latestVix}
            geoScore={summaryData?.geo_score ?? null}
            history={riskHistory}
          />
        </Card>

        {/* 현재 상태 카드 */}
        <section id="weekly-transit" className="scroll-mt-32 rounded-lg border border-slate-700/50 bg-slate-900 p-4">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 mb-4 text-lg font-bold text-white">
            {t("sections.weeklyTransit")}
          </h2>
          <CurrentStatusCards summary={weeklyTransitData} />
        </section>

        {/* 지도 */}
        <section id="map" className="scroll-mt-32">
          <StraitMapPanel />
        </section>

        {/* 통행 흐름 통합 차트 (통행량+유가 / 통행량 / 유형별) */}
        <Card title={t("sections.transitFlow")} className="scroll-mt-32" id="transit-flow">
          <TransitCombinedChart records={transitData} oilSeries={oilData} />
        </Card>

        {/* 유가 (TradingView 실시간) */}
        <Card title={t("sections.oilRealtime")} className="scroll-mt-32" id="oil">
          <TradingViewChart />
        </Card>

        {/* 미국 휘발유 가격 */}
        <Card title={t("gasoline.title")} className="scroll-mt-32" id="gasoline">
          <GasolinePricesPanel data={gasolineData} />
        </Card>

        {/* 시장 스냅샷 */}
        <section id="market" className="scroll-mt-32 rounded-lg border border-slate-700/50 bg-slate-900 p-4">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 mb-4 text-lg font-bold text-white">
            {t("sections.marketSnapshot")}
          </h2>
          <MarketSnapshotCards snapshots={marketData} intraday={marketHistory} ohlcv={marketOHLCV} />
        </section>

        {/* 최근 이벤트 */}
        <Card title={t("sections.recentEvents")} className="scroll-mt-32" id="events">
          <RecentEventsList events={eventsData} />
        </Card>

        {/* 트럼프 소셜 미디어 */}
        <Card title={t("trump.title")} className="scroll-mt-32" id="trump">
          <TrumpPostsFeed posts={trumpData} />
        </Card>

      </div>
    </PageShell>
  );
}
