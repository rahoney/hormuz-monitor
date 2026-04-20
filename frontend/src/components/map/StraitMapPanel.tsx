"use client";

import { useTranslations } from "next-intl";

export default function StraitMapPanel() {
  const t = useTranslations("dashboard.map");

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/50">
      <div className="border-b border-slate-700/50 bg-slate-900 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-300">{t("title")}</h2>
      </div>
      <div className="relative bg-slate-950" style={{ height: 340 }}>
        <iframe
          src="https://www.vesselfinder.com/widget?style=1&width=100%25&height=340&latitude=26.5&longitude=57&zoom=7&names=1&mmsi=&track=0"
          width="100%"
          height="340"
          style={{ border: "none", display: "block" }}
          title={t("placeholder")}
          loading="lazy"
        />
      </div>
    </div>
  );
}
