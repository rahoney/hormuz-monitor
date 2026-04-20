"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

// 호르무즈 해협 관심 구역
const STRAIT_BOUNDS = {
  center: [56.5, 26.5] as [number, number],
  zoom: 7,
};

export default function StraitMapPanel() {
  const t = useTranslations("dashboard.map");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: maplibregl.Map | null = null;

    import("maplibre-gl").then((maplibre) => {
      import("maplibre-gl/dist/maplibre-gl.css").catch(() => {});

      if (!containerRef.current) return;

      map = new maplibre.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: STRAIT_BOUNDS.center,
        zoom: STRAIT_BOUNDS.zoom,
        attributionControl: false,
      });

      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      // 해협 영역 강조 박스
      map.on("load", () => {
        if (!map) return;
        map.addSource("strait-zone", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[
                [55.5, 24.0], [60.5, 24.0],
                [60.5, 27.5], [55.5, 27.5],
                [55.5, 24.0],
              ]],
            },
          },
        });
        map.addLayer({
          id: "strait-fill",
          type: "fill",
          source: "strait-zone",
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.08 },
        });
        map.addLayer({
          id: "strait-border",
          type: "line",
          source: "strait-zone",
          paint: { "line-color": "#3b82f6", "line-width": 1, "line-opacity": 0.5 },
        });
      });
    });

    return () => {
      map?.remove();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/50">
      <div className="border-b border-slate-700/50 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">{t("title")}</h2>
        <span className="text-xs text-slate-500">Hormuz Strait</span>
      </div>
      <div ref={containerRef} style={{ height: 340, width: "100%" }} />
    </div>
  );
}
