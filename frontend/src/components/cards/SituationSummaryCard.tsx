"use client";

import { useTranslations, useLocale } from "next-intl";
import type { ReactNode } from "react";
import type { SituationSummary, StructuredSituationSummary, SummaryHighlight } from "@/types";
import ShareSummaryButton from "./ShareSummaryButton";
import ReactMarkdown from "react-markdown";

type Props = { summary: SituationSummary | null };

const toneClass: Record<SummaryHighlight["tone"], string> = {
  risk: "bg-pink-400/20 ring-pink-400/20",
  market: "bg-yellow-300/20 ring-yellow-300/20",
  watch: "bg-sky-400/15 ring-sky-400/15",
};

function isStructuredSummary(value: unknown): value is StructuredSituationSummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as StructuredSituationSummary;
  return (
    candidate.version === 1
    && Array.isArray(candidate.sections)
    && candidate.sections.length === 4
    && candidate.sections.every((section) => (
      typeof section.title === "string"
      && typeof section.body === "string"
      && Array.isArray(section.highlights)
    ))
  );
}

function renderHighlightedText(body: string, highlights: SummaryHighlight[]) {
  const valid = highlights
    .filter((item) => item.text && body.includes(item.text) && item.tone in toneClass)
    .sort((a, b) => body.indexOf(a.text) - body.indexOf(b.text) || b.text.length - a.text.length);

  const parts: ReactNode[] = [];
  let cursor = 0;
  valid.forEach((item, index) => {
    const start = body.indexOf(item.text, cursor);
    if (start < cursor) return;
    if (start > cursor) parts.push(body.slice(cursor, start));
    parts.push(
      <mark
        key={`${item.tone}-${index}-${start}`}
        className={`rounded px-1 py-0.5 font-normal text-slate-50 ring-1 ring-inset ${toneClass[item.tone]}`}
      >
        {item.text}
      </mark>
    );
    cursor = start + item.text.length;
  });
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

function StructuredSummaryView({ data }: { data: StructuredSituationSummary }) {
  return (
    <div className="space-y-5">
      {data.sections.map((section) => (
        <section key={section.title} className="border-t border-slate-600/30 pt-4 first:border-t-0 first:pt-0">
          <h3 className="mb-2 text-[17px] font-bold leading-6 text-slate-50">{section.title}</h3>
          <p className="leading-7 text-slate-200">
            {renderHighlightedText(section.body, section.highlights)}
          </p>
        </section>
      ))}
    </div>
  );
}

export default function SituationSummaryCard({ summary }: Props) {
  const t = useTranslations("dashboard.summary");
  const locale = useLocale();

  const text = summary
    ? (locale === "ko" ? summary.summary_ko : (summary.summary_en || summary.summary_ko))
    : null;
  const structuredCandidate = summary
    ? (locale === "ko" ? summary.summary_ko_structured : (summary.summary_en_structured || summary.summary_ko_structured))
    : null;
  const structured = isStructuredSummary(structuredCandidate) ? structuredCandidate : null;

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
        {structured ? (
          <StructuredSummaryView data={structured} />
        ) : text ? (
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
