"use client";

import { useEffect, useRef, useState } from "react";
import type { CandlestickData, IChartApi, LineData, LogicalRange, Time, UTCTimestamp } from "lightweight-charts";
import { useLocale } from "next-intl";
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
  timeScale: {
    borderColor: "rgba(51,65,85,0.5)",
    fixLeftEdge: true,
    fixRightEdge: true,
    rightOffset: 0,
    timeVisible: true,
  },
};

function marketTimeZone(locale: string): string {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browserTimeZone === "Asia/Seoul") {
    return "Asia/Seoul";
  }
  return locale.startsWith("ko") ? "Asia/Seoul" : "America/New_York";
}

function formatIntradayTime(timestamp: UTCTimestamp, locale: string, detail = false): string {
  const timeZone = marketTimeZone(locale);
  return new Intl.DateTimeFormat(locale.startsWith("ko") ? "ko-KR" : "en-US", {
    timeZone,
    ...(detail ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function formatDailyTime(time: Time, detail = false): string {
  if (typeof time === "string") {
    return detail ? time : time.slice(5);
  }
  if (typeof time === "object" && time !== null) {
    const month = String(time.month).padStart(2, "0");
    const day = String(time.day).padStart(2, "0");
    return detail ? `${time.year}-${month}-${day}` : `${month}-${day}`;
  }
  return String(time);
}

function formatChartTick(time: Time, tab: "5m" | "1d", locale: string): string {
  if (tab === "5m" && typeof time === "number") {
    return formatIntradayTime(time as UTCTimestamp, locale);
  }
  if (tab === "1d") {
    return formatDailyTime(time);
  }
  return String(time);
}

function formatChartDetail(time: Time, tab: "5m" | "1d", locale: string): string {
  if (tab === "5m" && typeof time === "number") {
    return formatIntradayTime(time as UTCTimestamp, locale, true);
  }
  if (tab === "1d") {
    return formatDailyTime(time, true);
  }
  return String(time);
}

function prepareIntraday(intraday: IntradayPoint[]): LineData<UTCTimestamp>[] {
  const seen = new Set<number>();
  return intraday
    .map((d) => ({
      time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
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

function movingAverage(data: CandlestickData[], period: number): LineData[] {
  const points: LineData[] = [];
  const closes: number[] = [];
  let sum = 0;

  for (const item of data) {
    const close = Number(item.close);
    if (!Number.isFinite(close)) continue;
    closes.push(close);
    sum += close;
    if (closes.length > period) {
      sum -= closes.shift() ?? 0;
    }
    if (closes.length === period) {
      points.push({
        time: item.time,
        value: Number((sum / period).toFixed(4)),
      });
    }
  }

  return points;
}

function clampLogicalRange(range: LogicalRange | null, dataLength: number): LogicalRange | null {
  if (!range || dataLength <= 1) return null;

  const max = dataLength - 1;
  const rangeFrom = Number(range.from);
  const rangeTo = Number(range.to);
  const width = rangeTo - rangeFrom;

  if (width >= max) {
    return rangeFrom === 0 && rangeTo === max ? null : { from: 0, to: max } as LogicalRange;
  }

  let from = rangeFrom;
  let to = rangeTo;

  if (from < 0) {
    to -= from;
    from = 0;
  }
  if (to > max) {
    from -= to - max;
    to = max;
  }
  if (from < 0) {
    from = 0;
  }

  if (from === rangeFrom && to === rangeTo) return null;
  return { from, to } as LogicalRange;
}

export default function MarketCustomChart({ symbol, intraday, ohlcv }: Props) {
  const locale = useLocale();
  const has5m = prepareIntraday(intraday).length > 0;
  const [tab, setTab] = useState<"5m" | "1d">(has5m ? "5m" : "1d");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: IChartApi | null = null;
    let ro: ResizeObserver | null = null;
    let logicalRangeHandler: ((range: LogicalRange | null) => void) | null = null;
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
            tickMarkMaxCharacterLength: tab === "5m" ? 5 : 5,
            tickMarkFormatter: (time: Time) => formatChartTick(time, tab, locale),
          },
          localization: {
            timeFormatter: (time: Time) => formatChartDetail(time, tab, locale),
          },
        });

        let dataLength = 0;

        if (tab === "5m") {
          const chartData = prepareIntraday(intraday);
          dataLength = chartData.length;
          if (chartData.length > 0) {
            const series = chart.addSeries(LineSeries, {
              color: "#3b82f6",
              lineWidth: 2,
            });
            try {
              series.setData(chartData);
            } catch {
              // 데이터 형식 문제 시 무시
            }
          }
        } else if (tab === "1d" && ohlcv.length > 0) {
          const chartData = ohlcv.map((d) => ({
            time:  d.price_date,
            open:  d.open,
            high:  d.high,
            low:   d.low,
            close: d.close,
          })) as CandlestickData[];
          dataLength = chartData.length;
          const series = chart.addSeries(CandlestickSeries, {
            upColor:         "#22c55e",
            downColor:       "#ef4444",
            borderUpColor:   "#22c55e",
            borderDownColor: "#ef4444",
            wickUpColor:     "#22c55e",
            wickDownColor:   "#ef4444",
          });
          try {
            series.setData(chartData);
            const ma20 = movingAverage(chartData, 20);
            const ma60 = movingAverage(chartData, 60);
            if (ma20.length > 0) {
              const ma20Series = chart.addSeries(LineSeries, {
                color: "#f59e0b",
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              ma20Series.setData(ma20);
            }
            if (ma60.length > 0) {
              const ma60Series = chart.addSeries(LineSeries, {
                color: "#a78bfa",
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              ma60Series.setData(ma60);
            }
          } catch {
            // 데이터 형식 문제 시 무시
          }
        }

        chart.timeScale().fitContent();
        if (dataLength > 1) {
          let adjusting = false;
          logicalRangeHandler = (range) => {
            if (adjusting || !chart) return;
            const clamped = clampLogicalRange(range, dataLength);
            if (!clamped) return;
            adjusting = true;
            chart.timeScale().setVisibleLogicalRange(clamped);
            adjusting = false;
          };
          chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);
        }

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
      if (chart && logicalRangeHandler) {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      }
      chart?.remove();
    };
  }, [tab, symbol, intraday, ohlcv, locale]);

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
            {t === "5m" ? "5분봉" : "일봉 90일"}
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
