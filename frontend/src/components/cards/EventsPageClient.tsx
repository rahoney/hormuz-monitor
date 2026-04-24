"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EventLogClient from "./EventLogClient";
import TrumpPostsFeed from "./TrumpPostsFeed";
import type { Event, TrumpPost } from "@/types";

type Tab = "events" | "trump";

type Props = { events: Event[]; trumpPosts: TrumpPost[] };

export default function EventsPageClient({ events, trumpPosts }: Props) {
  const t = useTranslations("events");
  const [tab, setTab] = useState<Tab>("events");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
      </div>
      <div className="flex gap-3">
        {(["events", "trump"] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md border-2 px-6 py-3 text-lg font-bold transition-colors ${
              tab === key
                ? "border-blue-400 bg-blue-400/10 text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
            }`}
          >
            {key === "events" ? t("tabs.events") : t("tabs.trump")}
          </button>
        ))}
      </div>
      {tab === "events" && <EventLogClient events={events} />}
      {tab === "trump" && <TrumpPostsFeed posts={trumpPosts} fullPage />}
    </div>
  );
}
