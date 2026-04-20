import { useTranslations } from "next-intl";
import PageShell from "@/components/layout/PageShell";

export default function SourcesPage() {
  const t = useTranslations("sources");

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-6 text-center text-sm text-slate-500">
          {t("emptyState")}
        </div>
      </div>
    </PageShell>
  );
}
