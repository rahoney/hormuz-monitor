"use client";

import { useState, useEffect, useRef } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { formatPrice, formatChangePct, changePctColor } from "@/lib/formatters";
import type { MarketSnapshot } from "@/types";

const SYMBOLS = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ"] as const;

const TV_SYMBOLS: Record<string, string> = {
  SP500:  "SP:SPX",
  NASDAQ: "NASDAQ:NDX",
  VIX:    "CBOE:VIX",
  KOSPI:  "KRX:KOSPI",
  KOSDAQ: "KRX:KOSDAQ",
};

type Props = {
  snapshots: Record<string, MarketSnapshot>;
  history: Record<string, { date: string; price: number }[]>;
};

function MarketTVChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tvSymbol = TV_SYMBOLS[symbol];
    if (!containerRef.current || !tvSymbol) return;
    containerRef.current.innerHTML = "";

    const inner = document.createElement("div");
    inner.id = `tv-market-${symbol}-${Date.now()}`;
    containerRef.current.appendChild(inner);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (!(window as any).TradingView || !containerRef.current) return;
      new (window as any).TradingView.widget({
        container_id: inner.id,
        width: "100%",
        height: 260,
        symbol: tvSymbol,
        interval: "D",
        timezone: "UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0f172a",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: true,
        save_image: false,
        backgroundColor: "#0f172a",
        gridColor: "rgba(51,65,85,0.3)",
      });
    };
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol]);

  return <div ref={containerRef} style={{ minHeight: 260 }} />;
}

export default function MarketSnapshotCards({ snapshots, history }: Props) {
  const t = useTranslations("dashboard");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SYMBOLS.map((sym) => {
          const snap = snapshots[sym];
          const spark = history[sym] ?? [];
          const isSelected = selected === sym;
          const isPositive = snap?.change_pct != null && snap.change_pct >= 0;

          return (
            <div
              key={sym}
              onClick={() => setSelected((prev) => (prev === sym ? null : sym))}
              className={[
                "relative overflow-hidden rounded-lg border p-3 cursor-pointer",
                "transition-all duration-200",
                "after:absolute after:inset-0 after:pointer-events-none after:rounded-lg",
                "after:bg-gradient-to-br after:from-white/[0.06] after:to-transparent",
                "after:opacity-0 after:transition-opacity after:duration-200",
                "hover:after:opacity-100",
                isSelected
                  ? "border-blue-500/60 bg-blue-900/20 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                  : "border-slate-700/50 bg-slate-900 hover:border-white/[0.10] hover:bg-white/[0.03]",
              ].join(" ")}
            >
              <p className="text-sm font-bold text-slate-200">{sym}</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {snap ? formatPrice(snap.price, sym === "VIX" ? 2 : 0) : t("noData")}
              </p>
              {snap?.change_pct !== undefined && (
                <p className={`text-xs ${changePctColor(snap.change_pct)}`}>
                  {formatChangePct(snap.change_pct)}
                </p>
              )}
              {spark.length >= 3 && (
                <div className="mt-2 h-10 w-full">
                  <ResponsiveContainer width="100%" height={40}>
                    <LineChart data={spark} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                      <YAxis domain={["auto", "auto"]} hide />
                      <Line
                        dataKey="price"
                        stroke={isPositive ? "#34d399" : "#f87171"}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 클릭 시 TradingView 차트 확장 */}
      {selected && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-200">{selected}</span>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          <MarketTVChart key={selected} symbol={selected} />
        </div>
      )}
    </div>
  );
}
