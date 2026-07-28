"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { SituationSummary, StructuredSituationSummary, SummaryHighlight } from "@/types";
import ShareSummaryButton from "./ShareSummaryButton";
import ReactMarkdown from "react-markdown";

type Props = { summary: SituationSummary | null };

const toneClass: Record<SummaryHighlight["tone"], string> = {
  risk: "bg-pink-400/20 ring-pink-400/20 text-pink-200",
  market: "bg-yellow-300/20 ring-yellow-300/20 text-yellow-200",
  watch: "bg-sky-400/15 ring-sky-400/15 text-sky-200",
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
        className={`rounded px-1 py-0.5 font-normal ring-1 ring-inset ${toneClass[item.tone]}`}
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

function defaultTimeZone(locale: string) {
  return locale === "ko" ? "Asia/Seoul" : "UTC";
}

function timeZoneLabel(timeZone: string, fallback: string) {
  if (timeZone === "Asia/Seoul") return "KST";
  if (timeZone === "UTC") return "UTC";
  return fallback;
}

function formatUpdatedAt(value: string, locale: string, timeZone: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const label = timeZoneLabel(timeZone, part("timeZoneName"));

  return `${part("month")}-${part("day")} ${part("hour")}:${part("minute")} ${label}`.trim();
}

export default function SituationSummaryCard({ summary }: Props) {
  const t = useTranslations("dashboard.summary");
  const locale = useLocale();
  const [timeZone, setTimeZone] = useState(() => defaultTimeZone(locale));
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translatedStructured, setTranslatedStructured] = useState<StructuredSituationSummary | null>(null);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimeZone) setTimeZone(browserTimeZone);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const hasServerTranslation = Boolean(
    summary
    && summary.locale_translated === locale
    && (isStructuredSummary(summary.summary_translated_structured) || summary.summary_translated_text)
  );

  // 12개 신규 언어 접속 시 서버 번역 데이터가 없을 때만 온디맨드 구조화 AI 번역 API 호출
  useEffect(() => {
    if (!summary || locale === "ko" || locale === "en" || hasServerTranslation) {
      setTranslatedText(null);
      setTranslatedStructured(null);
      setTranslationFailed(false);
      setLoadingTranslation(false);
      return;
    }

    let cancelled = false;
    setLoadingTranslation(true);
    setTranslationFailed(false);

    fetch(`/api/situation-summary/translate?summary_id=${summary.id}&locale=${encodeURIComponent(locale)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (isStructuredSummary(data?.summary_structured)) {
          setTranslatedStructured(data.summary_structured);
        } else if (data?.summary_text) {
          setTranslatedText(data.summary_text);
        } else {
          setTranslationFailed(true);
        }
      })
      .catch((err) => {
        console.error("translation error:", err);
        if (!cancelled) setTranslationFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingTranslation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [summary, locale, hasServerTranslation]);

  const isCustomLocale = locale !== "ko" && locale !== "en";

  const baseText = summary
    ? (locale === "ko" ? summary.summary_ko : (summary.summary_en || summary.summary_ko))
    : null;

  const serverTranslatedText = (summary && summary.locale_translated === locale) ? (summary.summary_translated_text ?? null) : null;
  const text = isCustomLocale ? (serverTranslatedText || translatedText) : baseText;

  const baseStructuredCandidate = summary
    ? (locale === "ko" ? summary.summary_ko_structured : (summary.summary_en_structured || summary.summary_ko_structured))
    : null;

  const baseStructured = (locale === "ko" || locale === "en") && isStructuredSummary(baseStructuredCandidate)
    ? baseStructuredCandidate
    : null;

  const serverTranslatedStructured = (summary && summary.locale_translated === locale && isStructuredSummary(summary.summary_translated_structured))
    ? summary.summary_translated_structured
    : null;

  const structuredToRender = isCustomLocale
    ? (serverTranslatedStructured || translatedStructured)
    : baseStructured;

  const updatedAt = summary ? formatUpdatedAt(summary.generated_at, locale, timeZone) : null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white border-2 border-blue-400 rounded-md px-3 py-1 inline-block">
            {t("title")}
          </h2>
          {(text || structuredToRender) && <ShareSummaryButton text={text || ""} />}
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
        {loadingTranslation ? (
          <div className="py-6 text-sm text-slate-400 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <span>{t("loading")}</span>
          </div>
        ) : translationFailed ? (
          <div className="py-4 text-sm text-slate-400">
            <p className="mb-2 font-medium text-slate-300">{t("noData")}</p>
            {baseText && (
              <details className="mt-3 rounded border border-slate-700/50 bg-slate-900/50 p-3 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-blue-400">View English Original</summary>
                <div className="mt-2 whitespace-pre-wrap">{baseText}</div>
              </details>
            )}
          </div>
        ) : structuredToRender ? (
          <StructuredSummaryView data={structuredToRender} />
        ) : text ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 last:mb-0">{children}</ul>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
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
