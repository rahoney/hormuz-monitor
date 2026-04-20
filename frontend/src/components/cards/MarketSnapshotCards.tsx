"use client";

import { useTranslations } from "next-intl";
import { formatPrice, formatChangePct, changePctColor } from "@/lib/formatters";
import type { MarketSnapshot } from "@/types";

const SYMBOLS = ["VIX", "NASDAQ", "SP500", "KOSPI", "KOSDAQ"] as const;

type Props = { snapshots: Record<string, MarketSnapshot> };

export default function MarketSnapshotCards({ snapshots }: Props) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SYMBOLS.map((sym) => {
        const snap = snapshots[sym];
        return (
          <div key={sym} className="rounded-lg border border-slate-700/50 bg-slate-900 p-3">
            <p className="text-xs font-medium text-slate-400">{sym}</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              {snap ? formatPrice(snap.price, sym === "VIX" ? 2 : 0) : t("noData")}
            </p>
            {snap?.change_pct !== undefined && (
              <p className={`text-xs ${changePctColor(snap.change_pct)}`}>
                {formatChangePct(snap.change_pct)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
