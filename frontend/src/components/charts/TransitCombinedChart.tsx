"use client";

import { useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import type { TransitRecord, OilPriceSeries } from "@/types";

type Tab = "comparison" | "total" | "breakdown";

type Props = {
  records: TransitRecord[];
  oilSeries: OilPriceSeries[];
};

export default function TransitCombinedChart({ records, oilSeries }: Props) {
  const t = useTranslations("dashboard.transit");
  const [active, setActive] = useState<Tab>("comparison");

  const brentMap = new Map(
    oilSeries.filter((r) => r.symbol === "BRENT").map((r) => [r.price_date, r.price_usd])
  );

  const data = records.map((r) => ({
    date:      r.transit_date.slice(5),
    vessels:   r.n_total,
    brent:     brentMap.get(r.transit_date) ?? null,
    tanker:    r.n_tanker,
    container: r.n_container,
    dry_bulk:  r.n_dry_bulk,
    general:   r.n_general_cargo,
  }));

  const TABS: { key: Tab; label: string }[] = [
    { key: "comparison", label: t("comparison") },
    { key: "total",      label: t("total") },
    { key: "breakdown",  label: t("breakdown") },
  ];

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">
        {t("noData")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`rounded px-3 py-1 text-sm font-semibold transition-colors ${
              active === key
                ? "bg-slate-600 text-slate-100"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "comparison" && (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="vessels" orientation="left"  tick={{ fill: "#60a5fa", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <YAxis yAxisId="brent"   orientation="right" tick={{ fill: "#34d399", fontSize: 10 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              formatter={(value, name) =>
                name === t("brent") ? [`$${Number(value).toFixed(2)}`, t("brent")] : [value, t("totalVessels")]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <Bar  yAxisId="vessels" dataKey="vessels" name={t("totalVessels")} fill="#60a5fa" opacity={0.7} radius={[2,2,0,0]} />
            <Line yAxisId="brent"   dataKey="brent"   name={t("brent")}       stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {active === "total" && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }} labelStyle={{ color: "#94a3b8", fontSize: 11 }} />
            <Bar dataKey="vessels" name={t("totalVessels")} fill="#60a5fa" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {active === "breakdown" && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }} labelStyle={{ color: "#94a3b8", fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
            <Bar dataKey="tanker"    name={t("tanker")}    fill="#f87171" stackId="a" />
            <Bar dataKey="container" name={t("container")} fill="#34d399" stackId="a" />
            <Bar dataKey="dry_bulk"  name={t("dryBulk")}   fill="#f59e0b" stackId="a" />
            <Bar dataKey="general"   name={t("general")}   fill="#a78bfa" stackId="a" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
