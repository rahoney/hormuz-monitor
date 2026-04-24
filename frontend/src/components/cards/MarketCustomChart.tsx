"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketOHLCV } from "@/types";

type IntradayPoint = { time: string; price: number };

type Props = {
  symbol: string;
  intraday: IntradayPoint[];
  ohlcv: MarketOHLCV[];
};

const CHART_OPTIONS = {
  layout: {
    background: { color: "#0f172a" },
    textColor: "#94a3b8",
  },
  grid: {
    vertLines: { color: "rgba(51,65,85,0.3)" },
    horzLines: { color: "rgba(51,65,85,0.3)" },
  },
  crosshair: { mode: 1 },
  rightPriceScale: { borderColor: "rgba(51,65,85,0.5)" },
  timeScale: { borderColor: "rgba(51,65,85,0.5)", timeVisible: true },
};

function prepareIntraday(intraday: IntradayPoint[]): { time: number; value: number }[] {
  const seen = new Set<number>();
  return intraday
    .map((d) => ({
      time: Math.floor(new Date(d.time).getTime() / 1000),
      value: d.price,
    }))
    .filter((d) => Number.isFinite(d.time) && d.value != null)
    .sort((a, b) => a.time - b.time)
    .filter((d) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    });
}

export default function MarketCustomChart({ symbol, intraday, ohlcv }: Props) {
  const has5m = prepareIntraday(intraday).length > 0;
  const [tab, setTab] = useState<"5m" | "1d">(has5m ? "5m" : "1d");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: any = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    import("lightweight-charts").then(({ createChart, ColorType, LineSeries, CandlestickSeries }) => {
      if (cancelled || !containerRef.current) return;

      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current) return;

        const el = containerRef.current;
        chart = createChart(el, {
          ...CHART_OPTIONS,
          layout: {
            ...CHART_OPTIONS.layout,
            background: { type: ColorType.Solid, color: "#0f172a" },
          },
          width: el.clientWidth,
          height: 260,
          timeScale: {
            ...CHART_OPTIONS.timeScale,
            timeVisible: tab === "5m",
            secondsVisible: false,
          },
        });

        if (tab === "5m") {
          const chartData = prepareIntraday(intraday);
          if (chartData.length > 0) {
            const series = chart.addSeries(LineSeries, {
              color: "#3b82f6",
              lineWidth: 1.5,
            });
            try {
              series.setData(chartData);
            } catch {
              // 데이터 형식 문제 시 무시
            }
          }
        } else if (tab === "1d" && ohlcv.length > 0) {
          const series = chart.addSeries(CandlestickSeries, {
            upColor:         "#22c55e",
            downColor:       "#ef4444",
            borderUpColor:   "#22c55e",
            borderDownColor: "#ef4444",
            wickUpColor:     "#22c55e",
            wickDownColor:   "#ef4444",
          });
          try {
            series.setData(
              ohlcv.map((d) => ({
                time:  d.price_date,
                open:  d.open,
                high:  d.high,
                low:   d.low,
                close: d.close,
              }))
            );
          } catch {
            // 데이터 형식 문제 시 무시
          }
        }

        chart.timeScale().fitContent();

        ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        ro.observe(el);
      });
    });

    return () => {
      cancelled = true;
      ro?.disconnect();
      chart?.remove();
    };
  }, [tab, symbol, intraday, ohlcv]);

  const has1d = ohlcv.length > 0;

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        {(["5m", "1d"] as const).filter((t) => t !== "5m" || has5m).map((t) => (
          <button
            key={t}
            onClick={(e) => { e.stopPropagation(); setTab(t); }}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              tab === t
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            }`}
          >
            {t === "5m" ? "5분봉" : "일봉 30일"}
          </button>
        ))}
      </div>
      {tab === "1d" && !has1d && (
        <p className="text-xs text-slate-500 text-center py-6">일봉 데이터 없음</p>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
