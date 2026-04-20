export function formatPrice(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatChangePct(value: number | null): string {
  if (value === null || isNaN(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function changePctColor(value: number | null): string {
  if (value === null || isNaN(value)) return "text-slate-400";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-slate-400";
}

export function statusLevelColor(level: string): string {
  switch (level) {
    case "normal":      return "text-emerald-400";
    case "restricted":  return "text-amber-400";
    case "high_risk":   return "text-red-400";
    default:            return "text-slate-400";
  }
}

export function statusLevelLabel(level: string): string {
  switch (level) {
    case "normal":      return "Normal";
    case "restricted":  return "Restricted";
    case "high_risk":   return "High Risk";
    default:            return "Unknown";
  }
}
