"use client";

import { useState, useRef, useEffect } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { useTranslations, useLocale } from "next-intl";
import { formatPrice, formatChangePct, changePctColor } from "@/lib/formatters";
import type { MarketOHLCV, MarketSnapshot } from "@/types";
import MarketCustomChart from "./MarketCustomChart";

export const ALL_SYMBOLS = [
  "SP500", "NASDAQ", "ES_FUTURES", "NQ_FUTURES", "VIX",
  "KOSPI", "KOSDAQ", "STOXX600", "NIKKEI225", "HANG_SENG", "SHANGHAI",
  "US10Y", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"
] as const;

type SymbolType = typeof ALL_SYMBOLS[number];

const CATEGORIES = [
  {
    id: "all",
    labels: {
      en: "All", ko: "전체", ar: "الكل", fa: "همه", ja: "すべて",
      es: "Todos", tr: "Tümü", de: "Alle", fr: "Tous", "pt-BR": "Todos",
      it: "Tutti", "zh-CN": "全部", "zh-TW": "全部", ru: "Все"
    }
  },
  {
    id: "us",
    labels: {
      en: "U.S. Indices", ko: "미국 증시", ar: "المؤشرات الأمريكية", fa: "شاخص‌های آمریکا", ja: "米国指数",
      es: "Índices EE.UU.", tr: "ABD Endeksleri", de: "US-Indizes", fr: "Indices US", "pt-BR": "Índices EUA",
      it: "Indici USA", "zh-CN": "美股指数", "zh-TW": "美股指數", ru: "Индексы США"
    }
  },
  {
    id: "global",
    labels: {
      en: "Global Indices", ko: "글로벌 증시", ar: "المؤشرات العالمية", fa: "شاخص‌های جهانی", ja: "グローバル指数",
      es: "Índices Globales", tr: "Küresel Endeksler", de: "Globale Indizes", fr: "Indices Mondiaux", "pt-BR": "Índices Globais",
      it: "Indici Globali", "zh-CN": "全球指数", "zh-TW": "全球指數", ru: "Мировые индексы"
    }
  },
  {
    id: "macro",
    labels: {
      en: "Rates & Commodities", ko: "금리/원자재/외환", ar: "الفائدة والسلع", fa: "نرخ‌ها و کالاها", ja: "금리・원자재・외환",
      es: "Tasas y Materias Primas", tr: "Faiz ve Emtialar", de: "Zinsen & Rohstoffe", fr: "Taux et Matières Premières", "pt-BR": "Juros e Commodities",
      it: "Tassi e Commodity", "zh-CN": "利率与商品", "zh-TW": "利率與商品", ru: "Ставки и товары"
    }
  },
] as const;

const CATEGORY_SYMBOLS: Record<string, SymbolType[]> = {
  all: [...ALL_SYMBOLS],
  us: ["SP500", "NASDAQ", "ES_FUTURES", "NQ_FUTURES", "VIX"],
  global: ["KOSPI", "KOSDAQ", "STOXX600", "NIKKEI225", "HANG_SENG", "SHANGHAI"],
  macro: ["US10Y", "GOLD_FUTURES", "USD_INDEX", "GASOLINE_FUTURES", "HEATING_OIL_FUTURES"],
};

const DISPLAY_NAMES: Record<string, string> = {
  SP500:               "S&P 500",
  NASDAQ:              "NASDAQ",
  ES_FUTURES:          "S&P Fut.",
  NQ_FUTURES:          "NASDAQ Fut.",
  VIX:                 "VIX",
  KOSPI:               "KOSPI",
  KOSDAQ:              "KOSDAQ",
  STOXX600:            "STOXX Europe 600",
  NIKKEI225:           "Nikkei 225",
  HANG_SENG:           "Hang Seng",
  SHANGHAI:            "Shanghai Comp.",
  US10Y:               "U.S. 10Y Yield",
  GOLD_FUTURES:        "Gold Fut.",
  USD_INDEX:           "USD Index",
  GASOLINE_FUTURES:    "Gasoline Fut.",
  HEATING_OIL_FUTURES: "Heating Oil Fut.",
};

const DISPLAY_NAMES_KO: Record<string, string> = {
  SP500:               "S&P 500",
  NASDAQ:              "나스닥",
  ES_FUTURES:          "S&P 선물",
  NQ_FUTURES:          "나스닥 선물",
  VIX:                 "VIX",
  KOSPI:               "코스피",
  KOSDAQ:              "코스닥",
  STOXX600:            "유럽 STOXX 600",
  NIKKEI225:           "닛케이 225",
  HANG_SENG:           "항셍 지수",
  SHANGHAI:            "상하이 종합",
  US10Y:               "미국 10년물 국채금리",
  GOLD_FUTURES:        "금 선물",
  USD_INDEX:           "달러 인덱스",
  GASOLINE_FUTURES:    "휘발유 선물",
  HEATING_OIL_FUTURES: "경유 선물",
};

const DECIMAL_2 = new Set(["VIX", "USD_INDEX", "US10Y"]);

type CardItemProps = {
  symbol: SymbolType;
  snap?: MarketSnapshot;
  sparklineData?: { price: number }[];
  ohlcvData?: MarketOHLCV[];
  displayName: string;
  onCardClick: (symbol: SymbolType) => void;
};

function MarketCardItem({
  symbol,
  snap,
  sparklineData,
  ohlcvData,
  displayName,
  onCardClick,
}: CardItemProps) {
  const t = useTranslations("dashboard");
  const priceDecimal = DECIMAL_2.has(symbol) ? 2 : undefined;
  const isUp = (snap?.change_pct ?? 0) >= 0;

  return (
    <div
      onClick={() => onCardClick(symbol)}
      className="cursor-pointer rounded-lg border border-slate-700/50 bg-slate-800/50 p-3.5 flex flex-col justify-between transition-all duration-200 hover:bg-white/[0.04] hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/5"
    >
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs font-semibold text-slate-300 truncate" title={displayName}>
            {displayName}
          </span>
          {snap && (
            <span className={`text-xs font-bold shrink-0 ${changePctColor(snap.change_pct)}`}>
              {formatChangePct(snap.change_pct)}
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          {snap ? (
            <span className="text-lg font-bold text-slate-100 tracking-tight">
              {formatPrice(snap.price, priceDecimal)}
            </span>
          ) : (
            <span className="text-sm font-medium text-slate-500">{t("noData")}</span>
          )}
        </div>
      </div>

      <div className="mt-3 h-10 w-full">
        {sparklineData && sparklineData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <YAxis domain={["auto", "auto"]} hide />
              <Line
                type="monotone"
                dataKey="price"
                stroke={isUp ? "#34d399" : "#f87171"}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : ohlcvData && ohlcvData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ohlcvData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <YAxis domain={["auto", "auto"]} hide />
              <Line
                type="monotone"
                dataKey="close"
                stroke={isUp ? "#34d399" : "#f87171"}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full bg-slate-800/30 rounded flex items-center justify-center">
            <span className="text-[10px] text-slate-600">No trend</span>
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  snapshots?: Record<string, MarketSnapshot>;
  intraday?: Record<string, { time: string; price: number }[]>;
  ohlcv?: Record<string, MarketOHLCV[]>;
};

export default function MarketSnapshotCards({
  snapshots = {},
  intraday = {},
  ohlcv = {},
}: Props) {
  const locale = useLocale();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolType | null>(null);
  const chartModalRef = useRef<HTMLDivElement>(null);

  const activeSymbols = CATEGORY_SYMBOLS[activeCategory] ?? ALL_SYMBOLS;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (chartModalRef.current && !chartModalRef.current.contains(e.target as Node)) {
        setSelectedSymbol(null);
      }
    }
    if (selectedSymbol) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedSymbol]);

  return (
    <div className="flex flex-col gap-4">
      {/* 14개 언어 대응 카테고리 탭 버튼 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const label = cat.labels[locale as keyof typeof cat.labels] ?? cat.labels.en;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 시장 스냅샷 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {activeSymbols.map((sym) => {
          const snap = snapshots[sym];
          const spark = intraday[sym];
          const ohlcvRows = ohlcv[sym];
          const name = locale === "ko" ? (DISPLAY_NAMES_KO[sym] ?? sym) : (DISPLAY_NAMES[sym] ?? sym);

          return (
            <MarketCardItem
              key={sym}
              symbol={sym}
              snap={snap}
              sparklineData={spark}
              ohlcvData={ohlcvRows}
              displayName={name}
              onCardClick={(symbol) => setSelectedSymbol(symbol)}
            />
          );
        })}
      </div>

      {/* 팝업 모달 */}
      {selectedSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            ref={chartModalRef}
            className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {locale === "ko"
                    ? DISPLAY_NAMES_KO[selectedSymbol] ?? selectedSymbol
                    : DISPLAY_NAMES[selectedSymbol] ?? selectedSymbol}
                </h3>
                <p className="text-xs text-slate-400">
                  {snapshots[selectedSymbol]
                    ? `${formatPrice(snapshots[selectedSymbol].price, DECIMAL_2.has(selectedSymbol) ? 2 : undefined)} (${formatChangePct(snapshots[selectedSymbol].change_pct)})`
                    : "No real-time price"}
                </p>
              </div>
              <button
                onClick={() => setSelectedSymbol(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <MarketCustomChart
              symbol={selectedSymbol}
              intraday={intraday[selectedSymbol] ?? []}
              ohlcv={ohlcv[selectedSymbol] ?? []}
            />
          </div>
        </div>
      )}
    </div>
  );
}
