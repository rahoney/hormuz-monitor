"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import type { GasolinePrice } from "@/types";

type Tab = "national" | "state";

type Props = { data: GasolinePrice[] };

export default function GasolinePricesPanel({ data }: Props) {
  const t = useTranslations("dashboard.gasoline");
  const [tab, setTab] = useState<Tab>("national");

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        {t("noData")}
      </div>
    );
  }

  // 전국 평균 라인 차트용 데이터
  const nationalData = data
    .filter((r) => r.area_code === "NUS")
    .map((r) => ({ date: r.price_date.slice(5), price: r.price_usd }));

  // 최신 날짜의 전국 + 지역 + 주별 데이터 (표용)
  const latestDate = data
    .filter((r) => r.area_code !== "NUS")
    .reduce((max, r) => (r.price_date > max ? r.price_date : max), "");

  const latestByArea = new Map<string, GasolinePrice>();
  const prevByArea = new Map<string, GasolinePrice>();

  // 각 area의 최신 2주 데이터 추출
  const areaGroups = new Map<string, GasolinePrice[]>();
  for (const r of data) {
    if (r.area_code === "NUS") continue;
    if (!areaGroups.has(r.area_code)) areaGroups.set(r.area_code, []);
    areaGroups.get(r.area_code)!.push(r);
  }
  for (const [code, rows] of areaGroups) {
    const sorted = rows.sort((a, b) => b.price_date.localeCompare(a.price_date));
    if (sorted[0]) latestByArea.set(code, sorted[0]);
    if (sorted[1]) prevByArea.set(code, sorted[1]);
  }

  const tableRows = Array.from(latestByArea.values()).sort((a, b) => {
    // national → region → state 순, 같은 타입이면 이름순
    const order = { national: 0, region: 1, state: 2 };
    const ao = order[a.area_type as keyof typeof order] ?? 3;
    const bo = order[b.area_type as keyof typeof order] ?? 3;
    return ao !== bo ? ao - bo : a.area_name.localeCompare(b.area_name);
  });

  return (
    <div className="flex flex-col gap-3">
      {/* 탭 */}
      <div className="flex gap-2">
        {(["national", "state"] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded px-3 py-1 text-sm font-semibold transition-colors ${
              tab === key ? "bg-slate-600 text-slate-100" : "text-slate-300 hover:text-white"
            }`}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {/* 전국 평균 라인 차트 */}
      {tab === "national" && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={nationalData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6 }}
              labelStyle={{ color: "#94a3b8", fontSize: 11 }}
              formatter={(v) => [`$${Number(v).toFixed(3)}`, t("pricePerGallon")]}
            />
            <Line dataKey="price" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* 지역·주별 가격 표 */}
      {tab === "state" && (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400">
                <th className="pb-2 pr-4 font-medium">{t("area")}</th>
                <th className="pb-2 pr-4 font-medium text-right">{t("price")}</th>
                <th className="pb-2 font-medium text-right">{t("weekChange")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const prev = prevByArea.get(row.area_code);
                const change = prev ? row.price_usd - prev.price_usd : null;
                return (
                  <tr key={row.area_code} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-4">
                      <span className={`font-medium ${row.area_type === "region" ? "text-slate-300" : "text-slate-200"}`}>
                        {row.area_name}
                      </span>
                      {row.area_type === "region" && (
                        <span className="ml-1.5 text-xs text-slate-500">{t("region")}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-medium text-blue-400">
                      ${row.price_usd.toFixed(3)}
                    </td>
                    <td className={`py-1.5 text-right text-xs font-medium ${
                      change === null ? "text-slate-500"
                      : change > 0 ? "text-red-400"
                      : change < 0 ? "text-emerald-400"
                      : "text-slate-400"
                    }`}>
                      {change === null ? "—"
                        : change > 0 ? `+$${change.toFixed(3)}`
                        : `$${change.toFixed(3)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
