import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";

type SourceItem = { name: string; detail: string; url: string };
type FreqRow = { source: string; frequency: string };

export default async function SourcesPage() {
  const t = await getTranslations("sources");

  const sections = [
    { key: "shipping", items: t.raw("shipping.items") as SourceItem[], heading: t("shipping.heading") },
    { key: "oil",      items: t.raw("oil.items")      as SourceItem[], heading: t("oil.heading") },
    { key: "market",   items: t.raw("market.items")   as SourceItem[], heading: t("market.heading") },
    { key: "events",   items: t.raw("events.items")   as SourceItem[], heading: t("events.heading") },
  ];

  const freqRows = t.raw("updateFrequency.rows") as FreqRow[];

  return (
    <PageShell>
      <div className="flex flex-col gap-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {sections.map(({ key, heading, items }) => (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-200">{heading}</h2>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.name} className="rounded-lg border border-slate-700/50 bg-slate-900 p-4">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    {item.name} →
                  </a>
                  <p className="mt-1 text-xs text-slate-400 leading-5">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-200">{t("updateFrequency.heading")}</h2>
          <div className="overflow-hidden rounded-lg border border-slate-700/50">
            <table className="w-full text-sm">
              <tbody>
                {freqRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-3 text-slate-300">{row.source}</td>
                    <td className="px-4 py-3 text-slate-400 text-right">{row.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-slate-600 border-t border-slate-800 pt-4 leading-5">
          {t("disclaimer")}
        </p>
      </div>
    </PageShell>
  );
}
