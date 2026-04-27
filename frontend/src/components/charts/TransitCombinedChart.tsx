"use client";

import { useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend, Cell,
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
    offshore:  Math.min(r.offshore_exit_count ?? 0, r.n_total),
    nonOffshore: Math.max(r.n_total - (r.offshore_exit_count ?? 0), 0),
    brent:     brentMap.has(r.transit_date) ? brentMap.get(r.transit_date) : undefined,
    tanker:    r.n_tanker,
    container: r.n_container,
    dry_bulk:  r.n_dry_bulk,
    general:   r.n_general_cargo,
    estimated: r.source === "aisstream_estimate",
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

      {active === "comparison" && (() => {
        const brentValues = data.map((d) => d.brent).filter((v): v is number => v !== null && v !== undefined);
        const actualMin = brentValues.length > 0 ? Math.min(...brentValues) : 0;
        const brentYMin = actualMin > 0 ? Math.floor(Math.min(actualMin, 40) / 10) * 10 : 40;

        return (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="vessels" orientation="left"  tick={{ fill: "#60a5fa", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="brent" type="number" orientation="right" tick={{ fill: "#34d399", fontSize: 10 }} tickLine={false} axisLine={false} width={34} tickFormatter={(v) => `$${v}`} domain={[brentYMin, 'auto']} allowDataOverflow={true} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
                labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                formatter={(value, name) => {
                  if (name === t("brent")) return [`$${Number(value).toFixed(2)}`, t("brent")];
                  if (name === t("offshoreExitEstimate")) return [value, t("offshoreExitEstimate")];
                  return [value, t("totalVessels")];
                }}
                labelFormatter={(label, payload) => {
                  const estimated = payload?.[0]?.payload?.estimated;
                  return `${label} · ${estimated ? t("estimated") : t("confirmed")}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar yAxisId="vessels" dataKey="offshore" stackId="transit" name={t("offshoreExitEstimate")} fill="#92400e" opacity={0.85} radius={[0,0,0,0]} />
              <Bar  yAxisId="vessels" dataKey="nonOffshore" stackId="transit" name={t("totalVessels")} fill="#60a5fa" opacity={0.7} radius={[2,2,0,0]}>
                {data.map((entry) => (
                  <Cell key={entry.date} fill={entry.estimated ? "#f59e0b" : "#60a5fa"} />
                ))}
              </Bar>
              <Line yAxisId="brent"   dataKey="brent"   name={t("brent")}       stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        );
      })()}

      {active === "total" && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              labelFormatter={(label, payload) => {
                const estimated = payload?.[0]?.payload?.estimated;
                return `${label} · ${estimated ? t("estimated") : t("confirmed")}`;
              }}
            />
            <Bar dataKey="offshore" stackId="transit" name={t("offshoreExitEstimate")} fill="#92400e" radius={[0,0,0,0]} />
            <Bar dataKey="nonOffshore" stackId="transit" name={t("totalVessels")} fill="#60a5fa" radius={[2,2,0,0]}>
              {data.map((entry) => (
                <Cell key={entry.date} fill={entry.estimated ? "#f59e0b" : "#60a5fa"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {active === "breakdown" && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              labelFormatter={(label, payload) => {
                const estimated = payload?.[0]?.payload?.estimated;
                return `${label} · ${estimated ? t("estimated") : t("confirmed")}`;
              }}
            />
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
