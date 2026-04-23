"use client";

import { useTranslations, useLocale } from "next-intl";

const KO_SOURCES = new Set(["연합뉴스", "한국경제", "매일경제"]);
import { Link } from "@/i18n/navigation";
import type { Event } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  attack:           "bg-red-900/60 text-red-300",
  closure:          "bg-orange-900/60 text-orange-300",
  sanctions:        "bg-yellow-900/60 text-yellow-300",
  ceasefire:        "bg-emerald-900/60 text-emerald-300",
  negotiation:      "bg-blue-900/60 text-blue-300",
  reopening:        "bg-teal-900/60 text-teal-300",
  escort_operation: "bg-purple-900/60 text-purple-300",
};

type Props = { events: Event[] };

export default function RecentEventsList({ events }: Props) {
  const t = useTranslations("dashboard");
  const te = useTranslations("events");
  const locale = useLocale();
  const filtered = (locale === "ko" ? events : events.filter((e) => !KO_SOURCES.has(e.source_name ?? ""))).slice(0, 5);

  if (filtered.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">{t("events.noEvents")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.map((ev) => (
        <div
          key={ev.id}
          className="relative overflow-hidden flex gap-3 rounded-lg px-2 py-1.5 -mx-2 border border-transparent transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.06] after:absolute after:inset-0 after:pointer-events-none after:rounded-lg after:bg-gradient-to-r after:from-white/[0.04] after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 hover:after:opacity-100"
        >
          <div className="shrink-0 pt-0.5">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                TYPE_COLORS[ev.event_type] ?? "bg-slate-800 text-slate-400"
              }`}
            >
              {te(`filters.${ev.event_type}` as any, { defaultValue: ev.event_type.replace(/_/g, " ") })}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            {ev.source_url ? (
              <a
                href={ev.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-slate-200 hover:text-blue-300"
              >
                {ev.title}
              </a>
            ) : (
              <p className="truncate text-sm text-slate-200">{ev.title}</p>
            )}
            <p className="text-xs text-slate-500">{ev.event_date}</p>
          </div>
        </div>
      ))}
      <Link
        href="/events"
        className="mt-1 text-xs text-blue-400 hover:text-blue-300"
      >
        {t("events.viewAll")}
      </Link>
    </div>
  );
}
