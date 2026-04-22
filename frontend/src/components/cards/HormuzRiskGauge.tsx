"use client";

import { useTranslations } from "next-intl";

const CX = 140, CY = 108, RO = 108, RI = 82;
const R   = (RO + RI) / 2;          // stroke 중심 반지름
const SW  = RO - RI;                 // stroke 굵기
const C   = 2 * Math.PI * R;        // 원 전체 둘레
const P   = Math.PI * R;            // 반원 둘레
const ZW  = P / 4;                  // 구간당 길이 (25%)
const GAP = 5;                      // 구간 사이 간격

function pt(score: number, r: number) {
  const a = Math.PI * (1 - score / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

const ZONES = [
  { color: "#ef4444", idx: 0 }, // 위험  0-25
  { color: "#f97316", idx: 1 }, // 경계 25-50
  { color: "#eab308", idx: 2 }, // 주의 50-75
  { color: "#22c55e", idx: 3 }, // 안전 75-100
];

function scoreColor(s: number) {
  if (s >= 76) return "#22c55e";
  if (s >= 51) return "#eab308";
  if (s >= 26) return "#f97316";
  return "#ef4444";
}

function computeScore(vessels: number | null, brent: number | null, vix: number | null): number {
  const t = vessels !== null ? Math.min(vessels / 70, 1) * 70 : 35;
  const b = brent !== null
    ? brent <= 80 ? 15 : brent >= 120 ? 0 : ((120 - brent) / 40) * 15
    : 7.5;
  const v = vix !== null
    ? vix <= 15 ? 15 : vix >= 35 ? 0 : ((35 - vix) / 20) * 15
    : 7.5;
  return Math.round(t + b + v);
}

type Props = { vessels: number | null; brent: number | null; vix: number | null };

export default function HormuzRiskGauge({ vessels, brent, vix }: Props) {
  const t = useTranslations("dashboard.gauge");
  const score = computeScore(vessels, brent, vix);
  const color = scoreColor(score);
  const tip = pt(score, RO - 6);

  const dash   = (ZW - GAP).toFixed(2);
  const gapLen = (C - (ZW - GAP)).toFixed(2);

  const riskLabel =
    score >= 76 ? t("safe")
    : score >= 51 ? t("caution")
    : score >= 26 ? t("warning")
    : t("danger");

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg viewBox="0 0 280 160" className="w-full max-w-xs">
        {/* 둥근 4색 구간 (stroke 방식) */}
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
        {/* 바늘 */}
        <line
          x1={CX} y1={CY}
          x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
          stroke={color} strokeWidth={3.5} strokeLinecap="round"
        />
        {/* 중앙 원 (단순하게 하나만) */}
        <circle cx={CX} cy={CY} r={8} fill={color} />
        {/* 점수 숫자 */}
        <text x={CX} y={CY + 30} textAnchor="middle" fontSize={30} fontWeight="bold" fill={color}>
          {score}
        </text>
        {/* 위험 레벨 라벨 */}
        <text x={CX} y={CY + 48} textAnchor="middle" fontSize={13} fill="#94a3b8">
          {riskLabel}
        </text>
      </svg>

      {/* 근거 데이터 */}
      <div className="flex gap-5 text-sm text-slate-400">
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
      </div>
    </div>
  );
}
