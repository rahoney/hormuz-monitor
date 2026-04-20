import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";
import Card from "@/components/ui/Card";
import CurrentStatusCards from "@/components/cards/CurrentStatusCards";
import OilPriceChart from "@/components/charts/OilPriceChart";
import MarketSnapshotCards from "@/components/cards/MarketSnapshotCards";
import RecentEventsList from "@/components/cards/RecentEventsList";
import StraitMapPanel from "@/components/map/StraitMapPanel";
import {
  fetchLatestStraitMetric,
  fetchOilPriceSeries,
  fetchLatestMarketSnapshots,
  fetchRecentEvents,
} from "@/lib/api/dashboard";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  const [metric, oilSeries, marketSnapshots, recentEvents] = await Promise.allSettled([
    fetchLatestStraitMetric(),
    fetchOilPriceSeries(["WTI", "BRENT", "NATURAL_GAS"], 90),
    fetchLatestMarketSnapshots(),
    fetchRecentEvents(5),
  ]);

  const metricData   = metric.status         === "fulfilled" ? metric.value         : null;
  const oilData      = oilSeries.status      === "fulfilled" ? oilSeries.value      : [];
  const marketData   = marketSnapshots.status === "fulfilled" ? marketSnapshots.value : {};
  const eventsData   = recentEvents.status   === "fulfilled" ? recentEvents.value   : [];

  return (
    <PageShell>
      <div className="flex flex-col gap-6">

        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {/* 현재 상태 카드 */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("sections.statusCards")}
          </h2>
          <CurrentStatusCards metric={metricData} />
        </section>

        {/* 지도 */}
        <StraitMapPanel />

        {/* 유가 + 최근 이벤트 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title={t("sections.oilPrices")}>
              <OilPriceChart series={oilData} />
            </Card>
          </div>
          <div>
            <Card title={t("sections.recentEvents")}>
              <RecentEventsList events={eventsData} />
            </Card>
          </div>
        </div>

        {/* 시장 스냅샷 */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("sections.marketSnapshot")}
          </h2>
          <MarketSnapshotCards snapshots={marketData} />
        </section>

      </div>
    </PageShell>
  );
}
