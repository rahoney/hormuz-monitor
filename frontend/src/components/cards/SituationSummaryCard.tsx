"use client";

import { useTranslations, useLocale } from "next-intl";
import type { SituationSummary } from "@/types";
import ShareSummaryButton from "./ShareSummaryButton";
import ReactMarkdown from "react-markdown";

type Props = { summary: SituationSummary | null };

export default function SituationSummaryCard({ summary }: Props) {
  const t = useTranslations("dashboard.summary");
  const locale = useLocale();

  const text = summary
    ? (locale === "ko" ? summary.summary_ko : summary.summary_en ?? summary.summary_ko)
    : null;

  const updatedAt = summary
    ? (() => {
        const d = new Date(summary.generated_at);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${mm}-${dd} ${hh}:${min}`;
      })()
    : null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white border-2 border-blue-400 rounded-md px-3 py-1 inline-block">
            {t("title")}
          </h2>
          {text && <ShareSummaryButton text={text} />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-blue-400 border border-blue-400/50 rounded px-2 py-0.5">
            {t("aiLabel")}
          </span>
          {updatedAt && (
            <span className="text-xs text-slate-500">
              {t("updated")} {updatedAt}
            </span>
          )}
        </div>
      </div>
      <div className="text-slate-200 leading-7" style={{ fontSize: "16px" }}>
        {text ? (
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 last:mb-0" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
            }}
          >
            {text}
          </ReactMarkdown>
        ) : (
          <p className="whitespace-pre-wrap">{t("noData")}</p>
        )}
      </div>
    </div>
  );
}
