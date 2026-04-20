import { useTranslations } from "next-intl";
import PageShell from "@/components/layout/PageShell";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["straitStatus", "vesselCount", "oilPrice", "riskLevel"].map((key) => (
            <div
              key={key}
              className="rounded-lg border border-slate-700/50 bg-slate-900 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t(`cards.${key}`)}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">—</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-6 text-center text-sm text-slate-500">
          {t("mapPlaceholder")}
        </div>
      </div>
    </PageShell>
  );
}
