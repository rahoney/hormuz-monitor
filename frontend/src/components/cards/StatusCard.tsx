type Props = {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClassName?: string;
};

export default function StatusCard({ label, value, sub, valueClassName = "text-blue-400" }: Props) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900 p-4">
      <p className="text-base font-bold text-white">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
      {sub && <p className="mt-1 text-base font-bold text-white">{sub}</p>}
    </div>
  );
}
