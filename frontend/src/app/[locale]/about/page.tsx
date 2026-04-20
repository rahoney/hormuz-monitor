import { useTranslations } from "next-intl";
import PageShell from "@/components/layout/PageShell";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <PageShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <p className="text-slate-300 leading-7">{t("description")}</p>
      </div>
    </PageShell>
  );
}
