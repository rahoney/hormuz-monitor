type Props = {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClassName?: string;
};

export default function StatusCard({ label, value, sub, valueClassName = "text-slate-100" }: Props) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
