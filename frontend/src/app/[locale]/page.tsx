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
import GasolinePricesPanel from "@/components/charts/GasolinePricesPanel";
import TrumpPostsFeed from "@/components/cards/TrumpPostsFeed";
import {
  fetchLatestStraitMetric,
  fetchOilPriceSeries,
  fetchLatestMarketSnapshots,
  fetchRecentEvents,
  fetchTransitSeries,
  fetchGasolinePrices,
  fetchTrumpPosts,
} from "@/lib/api/dashboard";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  const [metric, oilSeries, marketSnapshots, recentEvents, transitSeries, gasolineSeries, trumpPosts] = await Promise.allSettled([
    fetchLatestStraitMetric(),
    fetchOilPriceSeries(["WTI", "BRENT", "NATURAL_GAS"], 90),
    fetchLatestMarketSnapshots(),
    fetchRecentEvents(5),
    fetchTransitSeries(90),
    fetchGasolinePrices(90),
    fetchTrumpPosts(20),
  ]);

  const metricData  = metric.status         === "fulfilled" ? metric.value         : null;
  const oilData     = oilSeries.status      === "fulfilled" ? oilSeries.value      : [];
  const marketData  = marketSnapshots.status === "fulfilled" ? marketSnapshots.value : {};
  const eventsData  = recentEvents.status   === "fulfilled" ? recentEvents.value   : [];
  const transitData  = transitSeries.status  === "fulfilled" ? transitSeries.value  : [];
  const gasolineData = gasolineSeries.status === "fulfilled" ? gasolineSeries.value : [];
  const trumpData    = trumpPosts.status     === "fulfilled" ? trumpPosts.value     : [];

  const latestBrent = oilData
    .filter((r) => r.symbol === "BRENT")
    .sort((a, b) => b.price_date.localeCompare(a.price_date))[0]?.price_usd ?? null;
  const latestVix = (marketData as Record<string, { price: number }>)["VIX"]?.price ?? null;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">

        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {/* 호르무즈 위험 지수 게이지 */}
        <Card title={t("gauge.title")}>
          <HormuzRiskGauge
            vessels={metricData?.total_vessels ?? null}
            brent={latestBrent}
            vix={latestVix}
          />
        </Card>

        {/* 현재 상태 카드 */}
        <section className="rounded-lg border border-slate-700/50 bg-slate-900 p-4">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 mb-4 text-lg font-bold text-white">
            {t("sections.statusCards")}
          </h2>
          <CurrentStatusCards metric={metricData} />
        </section>

        {/* 지도 */}
        <StraitMapPanel />

        {/* 통행 흐름 통합 차트 (통행량+유가 / 통행량 / 유형별) */}
        <Card title={t("sections.transitFlow")}>
          <TransitCombinedChart records={transitData} oilSeries={oilData} />
        </Card>

        {/* 유가 (TradingView 실시간) */}
        <Card title={t("sections.oilRealtime")}>
          <TradingViewChart />
        </Card>

        {/* 미국 휘발유 가격 */}
        <Card title={t("gasoline.title")}>
          <GasolinePricesPanel data={gasolineData} />
        </Card>

        {/* 시장 스냅샷 */}
        <section className="rounded-lg border border-slate-700/50 bg-slate-900 p-4">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 mb-4 text-lg font-bold text-white">
            {t("sections.marketSnapshot")}
          </h2>
          <MarketSnapshotCards snapshots={marketData} />
        </section>

        {/* 최근 이벤트 */}
        <Card title={t("sections.recentEvents")}>
          <RecentEventsList events={eventsData} />
        </Card>

        {/* 트럼프 소셜 미디어 */}
        <Card title={t("trump.title")}>
          <TrumpPostsFeed posts={trumpData} />
        </Card>

      </div>
    </PageShell>
  );
}
