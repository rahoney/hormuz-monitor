"use client";

import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import type { TransitRecord, OilPriceSeries } from "@/types";

type Props = {
  transitRecords: TransitRecord[];
  oilSeries: OilPriceSeries[];
};

function buildChartData(transit: TransitRecord[], oil: OilPriceSeries[]) {
  const brentMap = new Map(
    oil.filter((r) => r.symbol === "BRENT").map((r) => [r.price_date, r.price_usd])
  );

  return transit.map((r) => ({
    date:    r.transit_date.slice(5),
    vessels: r.n_total,
    brent:   brentMap.has(r.transit_date) ? brentMap.get(r.transit_date) : undefined,
  }));
}

export default function TransitOilComparisonChart({ transitRecords, oilSeries }: Props) {
  const data = buildChartData(transitRecords, oilSeries);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">
        No data
      </div>
    );
  }

  const brentValues = data.map((d) => d.brent).filter((v): v is number => v !== null && v !== undefined);
  const actualMin = brentValues.length > 0 ? Math.min(...brentValues) : 0;
  const brentYMin = actualMin > 0 ? Math.floor(Math.min(actualMin, 40) / 10) * 10 : 40;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        {/* 좌측 Y축: 통행 선박 수 */}
        <YAxis
          yAxisId="vessels"
          orientation="left"
          tick={{ fill: "#60a5fa", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={28}
          label={{ value: "vessels", angle: -90, position: "insideLeft", fill: "#60a5fa", fontSize: 10, dy: 30 }}
        />
        {/* 우측 Y축: Brent 유가 */}
        <YAxis
          yAxisId="brent"
          type="number"
          orientation="right"
          tick={{ fill: "#34d399", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={34}
          tickFormatter={(v) => `$${v}`}
          label={{ value: "USD/bbl", angle: 90, position: "insideRight", fill: "#34d399", fontSize: 10, dy: -30 }}
          domain={[brentYMin, 'auto']}
          allowDataOverflow={true}
        />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
          labelStyle={{ color: "#94a3b8", fontSize: 11 }}
          formatter={(value, name) =>
            name === "Brent"
              ? [`$${Number(value).toFixed(2)}`, "Brent"]
              : [value, "Vessels"]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        <Bar
          yAxisId="vessels"
          dataKey="vessels"
          name="Vessels"
          fill="#60a5fa"
          opacity={0.7}
          radius={[2, 2, 0, 0]}
        />
        <Line
          yAxisId="brent"
          dataKey="brent"
          name="Brent"
          stroke="#34d399"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
