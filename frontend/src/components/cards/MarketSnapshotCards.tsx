"use client";

import { useState, useRef, useEffect } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { useTranslations, useLocale } from "next-intl";
import { formatPrice, formatChangePct, changePctColor } from "@/lib/formatters";
import type { MarketOHLCV, MarketSnapshot } from "@/types";
import MarketCustomChart from "./MarketCustomChart";

const SYMBOLS = ["SP500", "NASDAQ", "ES_FUTURES", "NQ_FUTURES", "VIX", "KOSPI", "KOSDAQ"] as const;

const DISPLAY_NAMES: Record<string, string> = {
  SP500:      "S&P 500",
  ES_FUTURES: "S&P Fut.",
  NQ_FUTURES: "NASDAQ Fut.",
};

const DISPLAY_NAMES_KO: Record<string, string> = {
  SP500:      "S&P 500",
  NASDAQ:     "나스닥",
  ES_FUTURES: "S&P 선물",
  NQ_FUTURES: "나스닥 선물",
  KOSPI:      "코스피",
  KOSDAQ:     "코스닥",
};

const DECIMAL_2 = new Set(["VIX"]);
const POPOVER_WIDTH = 480;
const POPOVER_MARGIN = 12;

type Props = {
  snapshots: Record<string, MarketSnapshot>;
  intraday: Record<string, { time: string; price: number }[]>;
  ohlcv: Record<string, MarketOHLCV[]>;
};

type CardProps = {
  sym: typeof SYMBOLS[number];
  snap: MarketSnapshot | undefined;
  spark: { time: string; price: number }[];
  ohlcv: MarketOHLCV[];
  noDataLabel: string;
  displayName: string;
};

function MarketCard({ sym, snap, spark, ohlcv, noDataLabel, displayName }: CardProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPositive = snap?.change_pct != null && snap.change_pct >= 0;

  // 인트라데이 없으면 일봉 종가로 폴백
  const sparkData = spark.length >= 3
    ? spark
    : ohlcv.slice(-30).map((d) => ({ time: d.price_date, price: d.close }));

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  };

  const updatePopoverPosition = () => {
    if (!wrapperRef.current || typeof window === "undefined") return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - POPOVER_MARGIN * 2);
    const clampedLeft = Math.min(
      Math.max(rect.left, POPOVER_MARGIN),
      window.innerWidth - width - POPOVER_MARGIN
    );

    setPopoverStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: clampedLeft,
      width,
    });
  };

  const openPopover = () => {
    updatePopoverPosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${open ? "z-50" : ""}`}
      onMouseEnter={() => { cancelClose(); openPopover(); }}
      onMouseLeave={scheduleClose}
    >
      {/* 카드 본체 */}
      <div
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openPopover();
          }
        }}
        className={[
          "overflow-hidden rounded-lg border p-3 cursor-pointer",
          "transition-all duration-200",
          "after:absolute after:inset-0 after:pointer-events-none after:rounded-lg",
          "after:bg-gradient-to-br after:from-white/[0.06] after:to-transparent",
          "after:opacity-0 after:transition-opacity after:duration-200",
          "hover:after:opacity-100",
          open
            ? "border-blue-500/60 bg-blue-900/20 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
            : "border-slate-700/50 bg-slate-900 hover:border-white/[0.10] hover:bg-white/[0.03]",
        ].join(" ")}
      >
        <p className="text-sm font-bold text-slate-200">{displayName}</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">
          {snap ? formatPrice(snap.price, DECIMAL_2.has(sym) ? 2 : 0) : noDataLabel}
        </p>
        {snap?.change_pct != null && (
          <p className={`text-xs ${changePctColor(snap.change_pct)}`}>
            {formatChangePct(snap.change_pct)}
          </p>
        )}
        {sparkData.length >= 3 && (
          <div className="mt-2 h-10 w-full">
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={sparkData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                <YAxis domain={["auto", "auto"]} hide />
                <Line
                  dataKey="price"
                  isAnimationActive={false}
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

      {/* 카드 바로 아래 커스텀 차트 (절대 위치) */}
      {open && (
        <div
          className="z-50 rounded-lg border border-slate-700/50 bg-slate-900 p-3 shadow-xl"
          style={popoverStyle}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-300">{displayName}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          <MarketCustomChart symbol={sym} intraday={spark} ohlcv={ohlcv} />
        </div>
      )}
    </div>
  );
}

export default function MarketSnapshotCards({ snapshots, intraday, ohlcv }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const names = locale === "ko" ? DISPLAY_NAMES_KO : DISPLAY_NAMES;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
      {SYMBOLS.map((sym) => (
        <MarketCard
          key={sym}
          sym={sym}
          snap={snapshots[sym]}
          spark={intraday[sym] ?? []}
          ohlcv={ohlcv[sym] ?? []}
          noDataLabel={t("noData")}
          displayName={names[sym] ?? sym}
        />
      ))}
    </div>
  );
}
