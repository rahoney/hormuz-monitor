"use client";

import { useTranslations, useLocale } from "next-intl";
import type { Event } from "@/types";

const KO_SOURCES = new Set(["연합뉴스", "한국경제", "매일경제"]);

const TYPE_COLORS: Record<string, string> = {
  attack:           "bg-red-900/60 text-red-300 border border-red-700/40",
  closure:          "bg-orange-900/60 text-orange-300 border border-orange-700/40",
  sanctions:        "bg-yellow-900/60 text-yellow-300 border border-yellow-700/40",
  ceasefire:        "bg-emerald-900/60 text-emerald-300 border border-emerald-700/40",
  negotiation:      "bg-blue-900/60 text-blue-300 border border-blue-700/40",
  reopening:        "bg-teal-900/60 text-teal-300 border border-teal-700/40",
  escort_operation: "bg-purple-900/60 text-purple-300 border border-purple-700/40",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
  low:      "text-slate-400",
};

type Props = { events: Event[] };

export default function EventLogClient({ events }: Props) {
  const t = useTranslations("events");
  const locale = useLocale();
  const filtered = locale === "ko" ? events : events.filter((e) => !KO_SOURCES.has(e.source_name ?? ""));

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case "attack": return t("filters.attack");
      case "closure": return t("filters.closure");
      case "reopening": return t("filters.reopening");
      case "sanctions": return t("filters.sanctions");
      case "ceasefire": return t("filters.ceasefire");
      case "negotiation": return t("filters.negotiation");
      case "escort_operation": return t("filters.escort_operation");
      default: return type.replace(/_/g, " ");
    }
  };

  const severityLabel = (severity: string) => {
    switch (severity) {
      case "critical": return t("severity.critical");
      case "high": return t("severity.high");
      case "medium": return t("severity.medium");
      case "low": return t("severity.low");
      default: return severity;
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-8 text-center text-sm text-slate-500">
        {t("emptyState")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.map((ev) => (
        <div
          key={ev.id}
          className="relative overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900 p-4 flex gap-4 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.08] after:absolute after:inset-0 after:pointer-events-none after:rounded-lg after:bg-gradient-to-r after:from-white/[0.04] after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-100"
        >
          <div className="shrink-0 w-20 text-xs text-slate-500 pt-0.5">{ev.event_date}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[ev.event_type] ?? "bg-slate-800 text-slate-400"}`}>
                {eventTypeLabel(ev.event_type)}
              </span>
              {ev.severity && (
                <span className={`text-xs ${SEVERITY_COLORS[ev.severity] ?? "text-slate-400"}`}>
                  {severityLabel(ev.severity)}
                </span>
              )}
            </div>
            {ev.source_url ? (
              <a
                href={ev.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-slate-200 hover:text-blue-300 font-medium mb-1"
              >
                {ev.title}
              </a>
            ) : (
              <p className="text-sm text-slate-200 font-medium mb-1">{ev.title}</p>
            )}
            {ev.summary && (
              <p className="text-xs text-slate-400 leading-5">{ev.summary}</p>
            )}
            {ev.source_name && (
              <p className="text-xs text-slate-600 mt-1">{ev.source_name}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
