"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import type { TransitRecord } from "@/types";

type Props = { records: TransitRecord[] };

const TABS = ["total", "breakdown"] as const;

export default function TransitFlowChart({ records }: Props) {
  const t = useTranslations("dashboard.transit");
  const [active, setActive] = useState<"total" | "breakdown">("total");

  const data = records.map((r) => ({
    date: r.transit_date.slice(5),
    total: r.n_total,
    offshore: Math.min(r.offshore_exit_count ?? 0, r.n_total),
    nonOffshore: Math.max(r.n_total - (r.offshore_exit_count ?? 0), 0),
    tanker: r.n_tanker,
    container: r.n_container,
    dry_bulk: r.n_dry_bulk,
    general: r.n_general_cargo,
    estimated: r.source === "aisstream_estimate",
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              active === tab
                ? "bg-slate-600 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          {t("noData")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              labelFormatter={(label, payload) => {
                const estimated = payload?.[0]?.payload?.estimated;
                return `${label} · ${estimated ? t("estimated") : t("confirmed")}`;
              }}
            />
            {active === "total" ? (
              <>
              <Bar dataKey="offshore" stackId="transit" fill="#92400e" radius={[0, 0, 0, 0]} name={t("offshoreExitEstimate")} />
              <Bar dataKey="nonOffshore" stackId="transit" fill="#60a5fa" radius={[2, 2, 0, 0]} name={t("totalVessels")}>
                {data.map((entry) => (
                  <Cell key={entry.date} fill={entry.estimated ? "#f59e0b" : "#60a5fa"} />
                ))}
              </Bar>
              </>
            ) : (
              <>
                <Bar dataKey="tanker"    fill="#f87171" stackId="a" radius={[0, 0, 0, 0]} name={t("tanker")} />
                <Bar dataKey="container" fill="#34d399" stackId="a" name={t("container")} />
                <Bar dataKey="dry_bulk"  fill="#f59e0b" stackId="a" name={t("dryBulk")} />
                <Bar dataKey="general"   fill="#a78bfa" stackId="a" radius={[2, 2, 0, 0]} name={t("general")} />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
