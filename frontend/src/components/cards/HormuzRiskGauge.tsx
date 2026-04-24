"use client";

import { useTranslations } from "next-intl";
import type { RiskScoreHistory } from "@/types";

const CX = 140, CY = 108, RO = 108, RI = 82;
const R   = (RO + RI) / 2;
const SW  = RO - RI;
const C   = 2 * Math.PI * R;
const P   = Math.PI * R;
const ZW  = P / 4;
const GAP = 5;

function pt(score: number, r: number) {
  const a = Math.PI * (1 - score / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

const ZONES = [
  { color: "#ef4444", idx: 0 },
  { color: "#f97316", idx: 1 },
  { color: "#eab308", idx: 2 },
  { color: "#22c55e", idx: 3 },
];

function scoreColor(s: number) {
  if (s >= 76) return "#22c55e";
  if (s >= 51) return "#eab308";
  if (s >= 26) return "#f97316";
  return "#ef4444";
}

function geoRawColor(raw: number) {
  if (raw <= 7)  return "#22c55e";
  if (raw <= 15) return "#eab308";
  if (raw <= 22) return "#f97316";
  return "#ef4444";
}

function computeScore(
  vessels: number | null,
  brent: number | null,
  vix: number | null,
  geoScore: number | null,
): number {
  const v = vessels !== null ? Math.min(vessels / 70, 1) * 40 : 20;
  const b = brent !== null
    ? brent <= 80 ? 15 : brent >= 120 ? 0 : ((120 - brent) / 40) * 15
    : 7.5;
  const vi = vix !== null
    ? vix <= 15 ? 15 : vix >= 35 ? 0 : ((35 - vix) / 20) * 15
    : 7.5;

  if (geoScore !== null) {
    const g = ((30 - geoScore) / 29) * 30;
    return Math.round(Math.min(v + g + b + vi, 100));
  }
  // fallback: geo 없으면 통행량 70%로
  const vFallback = vessels !== null ? Math.min(vessels / 70, 1) * 70 : 35;
  return Math.round(Math.min(vFallback + b + vi, 100));
}

function findClosest(history: RiskScoreHistory[], daysAgo: number): RiskScoreHistory | null {
  const target = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  let best: RiskScoreHistory | null = null;
  let bestDiff = Infinity;
  for (const row of history) {
    const diff = Math.abs(new Date(row.score_date).getTime() - new Date(target).getTime());
    if (diff < bestDiff) { bestDiff = diff; best = row; }
  }
  // 3일 이내만 허용
  return best && bestDiff <= 3 * 86_400_000 ? best : null;
}

type Props = {
  vessels: number | null;
  brent: number | null;
  vix: number | null;
  geoScore: number | null;
  history: RiskScoreHistory[];
};

export default function HormuzRiskGauge({ vessels, brent, vix, geoScore, history }: Props) {
  const t = useTranslations("dashboard.gauge");
  const score = computeScore(vessels, brent, vix, geoScore);
  const color = scoreColor(score);
  const tip = pt(score, RO - 6);

  const dash   = (ZW - GAP).toFixed(2);
  const gapLen = (C - (ZW - GAP)).toFixed(2);

  const riskLabel =
    score >= 76 ? t("safe")
    : score >= 51 ? t("caution")
    : score >= 26 ? t("warning")
    : t("danger");

  const comparisons = [
    { labelKey: "hist1d",  daysAgo: 1  },
    { labelKey: "hist1w",  daysAgo: 7  },
    { labelKey: "hist2w",  daysAgo: 14 },
    { labelKey: "hist1m",  daysAgo: 30 },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-3 py-2 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
      {/* 게이지 */}
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 280 160" className="w-full max-w-xs">
          {ZONES.map(({ color: zc, idx }) => (
            <circle
              key={idx}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={zc}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gapLen}`}
              strokeDashoffset={(-(idx * ZW) + GAP / 2).toFixed(2)}
              transform={`rotate(180, ${CX}, ${CY})`}
              opacity={0.85}
            />
          ))}
          <line
            x1={CX} y1={CY}
            x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
            stroke={color} strokeWidth={3.5} strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={8} fill={color} />
          <text x={CX} y={CY + 30} textAnchor="middle" fontSize={30} fontWeight="bold" fill={color}>
            {score}
          </text>
          <text x={CX} y={CY + 48} textAnchor="middle" fontSize={13} fill="#94a3b8">
            {riskLabel}
          </text>
        </svg>

        {/* 근거 데이터 */}
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400">
          <span>
            {t("vessels")}: <span className="font-medium text-blue-400">{vessels ?? "—"}</span>
            <span className="text-slate-500">/70</span>
          </span>
          <span>
            Brent: <span className="font-medium text-blue-400">
              {brent != null ? `$${brent.toFixed(1)}` : "—"}
            </span>
          </span>
          <span>
            VIX: <span className="font-medium text-blue-400">
              {vix != null ? vix.toFixed(1) : "—"}
            </span>
          </span>
          {geoScore != null && (
            <span>
              {t("geoLabel")}: <span className="font-medium" style={{ color: geoRawColor(geoScore) }}>
                {geoScore}/30
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 과거 비교 */}
      <div className="flex flex-col gap-2 min-w-[120px]">
        {comparisons.map(({ labelKey, daysAgo }) => {
          const row = findClosest(history, daysAgo);
          const past = row ? Math.round(row.total_score) : null;
          const diff = past !== null ? score - past : null;
          return (
            <div key={labelKey} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-300 font-bold" style={{ fontSize: "18px" }}>{t(labelKey)}</span>
              <div className="flex items-center gap-1.5">
                {past !== null ? (
                  <>
                    <span className="font-semibold" style={{ color: scoreColor(past) }}>{past}</span>
                    {diff !== null && diff !== 0 && (
                      <span className={`text-xs font-medium ${diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                      </span>
                    )}
                    {diff === 0 && <span className="text-xs text-slate-500">—</span>}
                  </>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
