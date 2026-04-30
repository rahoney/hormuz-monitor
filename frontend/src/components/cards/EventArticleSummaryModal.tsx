"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fetchEventArticleSummary } from "@/lib/api/eventArticleSummary";
import type { Event, EventArticleSummary } from "@/types";

type Props = {
  event: Event | null;
  onClose: () => void;
};

export default function EventArticleSummaryModal({ event, onClose }: Props) {
  const locale = useLocale();
  const t = useTranslations("events.articleSummary");
  const [summary, setSummary] = useState<EventArticleSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    setSummary(null);
    setError(false);
    setLoading(true);

    fetchEventArticleSummary(event.id, locale)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event, locale]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">{t("label")}</p>
              <h3 className="mt-1 text-base font-semibold leading-6 text-slate-100">{event.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{event.source_name ?? t("unknownSource")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              aria-label={t("close")}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {loading && (
            <p className="rounded-md border border-slate-800 bg-slate-900 px-3 py-4 text-sm text-slate-400">
              {t("loading")}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-4 text-sm text-red-300">
              {t("error")}
            </p>
          )}
          {summary && (
            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{summary.summary}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-blue-500/50 px-3 py-2 text-center text-sm text-blue-200 transition-colors hover:bg-blue-500/10 hover:text-blue-100"
            >
              {t("openOriginal")}
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
