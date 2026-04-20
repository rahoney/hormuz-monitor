"use client";

import { useTranslations } from "next-intl";
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

  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">{t("events.noEvents")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((ev) => (
        <div key={ev.id} className="flex gap-3">
          <div className="shrink-0 pt-0.5">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                TYPE_COLORS[ev.event_type] ?? "bg-slate-800 text-slate-400"
              }`}
            >
              {ev.event_type.replace("_", " ")}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-200">{ev.title}</p>
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
