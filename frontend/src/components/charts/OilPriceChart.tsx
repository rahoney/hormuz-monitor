"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import type { OilPriceSeries } from "@/types";

type Props = { series: OilPriceSeries[] };

const COLORS: Record<string, string> = {
  WTI: "#60a5fa",
  BRENT: "#34d399",
  NATURAL_GAS: "#f59e0b",
};

const TABS = ["WTI", "BRENT", "NATURAL_GAS"] as const;

function buildChartData(series: OilPriceSeries[], symbol: string) {
  return series
    .filter((r) => r.symbol === symbol)
    .map((r) => ({ date: r.price_date.slice(5), price: r.price_usd }));
}

export default function OilPriceChart({ series }: Props) {
  const t = useTranslations("dashboard.oil");
  const [active, setActive] = useState<string>("BRENT");

  const labels: Record<string, string> = {
    WTI: t("wti"),
    BRENT: t("brent"),
    NATURAL_GAS: t("naturalGas"),
  };

  const data = buildChartData(series, active);
  const unit = active === "NATURAL_GAS" ? t("perMmbtu") : t("perBbl");
  const color = COLORS[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {TABS.map((sym) => (
          <button
            key={sym}
            onClick={() => setActive(sym)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              active === sym
                ? "bg-slate-600 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {labels[sym]}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
              width={48}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              itemStyle={{ color: color }}
              formatter={(v) => [`$${Number(v).toFixed(2)} ${unit}`, labels[active]]}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
