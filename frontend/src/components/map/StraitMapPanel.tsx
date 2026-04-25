"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MARINE_TRAFFIC_URL =
  "https://www.marinetraffic.com/en/ais/embed/zoom:8/centerx:56.2/centery:26.5/maptype:4/shownames:true/fleet:false/showmenu:true";

const MY_SHIP_TRACKING_URL =
  "https://embed.myshiptracking.com/embed?myst&zoom=8&lat=26.5&lng=56.2&show_names=1&map_style=simple";

const MT_EXTRA = 44; // MarineTraffic 하단 밴드 높이
const MAP_HEIGHT = 480;

export default function StraitMapPanel() {
  const t = useTranslations("dashboard.map");
  const [activeTab, setActiveTab] = useState<"mt" | "mst">("mt");

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/50">
      <div className="border-b border-slate-700/50 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 text-lg font-bold text-white">{t("title")}</h2>
          <div className="flex rounded border border-slate-700 text-xs font-bold overflow-hidden">
            <button
              onClick={() => setActiveTab("mt")}
              className={`px-3 py-1 transition-colors ${
                activeTab === "mt"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("map1")}
            </button>
            <button
              onClick={() => setActiveTab("mst")}
              className={`px-3 py-1 transition-colors border-l border-slate-700 ${
                activeTab === "mst"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("map2")}
            </button>
          </div>
        </div>
        <span className="text-xs text-slate-500">Live AIS</span>
      </div>

      {/* MarineTraffic */}
      <div
        className="relative"
        style={{
          height: MAP_HEIGHT,
          overflow: "hidden",
          display: activeTab === "mt" ? "block" : "none",
        }}
      >
        <iframe
          src={MARINE_TRAFFIC_URL}
          title="MarineTraffic Live Map"
          className="w-full border-0"
          style={{ height: MAP_HEIGHT + MT_EXTRA, display: "block", pointerEvents: "none" }}
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      {/* MyShipTracking */}
      {activeTab === "mst" && (
        <div
          className="relative"
          style={{
            height: MAP_HEIGHT,
            overflow: "hidden",
          }}
        >
          <iframe
            key="myshiptracking-active"
            src={MY_SHIP_TRACKING_URL}
            title="MyShipTracking Live Map"
            className="w-full border-0"
            style={{ height: MAP_HEIGHT, display: "block", pointerEvents: "none" }}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
