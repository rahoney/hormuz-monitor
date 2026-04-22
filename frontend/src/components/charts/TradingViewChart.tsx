"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const SYMBOLS = [
  { key: "WTI",         symbol: "TVC:USOIL",  label: "WTI" },
  { key: "BRENT",       symbol: "TVC:UKOIL",  label: "Brent" },
  { key: "NATURAL_GAS", symbol: "CAPITALCOM:NATURALGAS", label: "Natural Gas" },
] as const;

type SymbolKey = typeof SYMBOLS[number]["key"];

export default function TradingViewChart() {
  const t = useTranslations("dashboard.oil");
  const [active, setActive] = useState<SymbolKey>("BRENT");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 이전 위젯 제거
    containerRef.current.innerHTML = "";

    const inner = document.createElement("div");
    inner.id = `tv-widget-${active}-${Date.now()}`;
    containerRef.current.appendChild(inner);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (!(window as any).TradingView || !containerRef.current) return;
      new (window as any).TradingView.widget({
        container_id: inner.id,
        width: "100%",
        height: 280,
        symbol: SYMBOLS.find((s) => s.key === active)!.symbol,
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
  }, [active]);

  const labels: Record<SymbolKey, string> = {
    WTI:         t("wti"),
    BRENT:       t("brent"),
    NATURAL_GAS: t("naturalGas"),
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {SYMBOLS.map(({ key }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`rounded px-3 py-1 text-sm font-semibold transition-colors ${
              active === key
                ? "bg-slate-600 text-slate-100"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      <div ref={containerRef} style={{ minHeight: 280 }} />
    </div>
  );
}
