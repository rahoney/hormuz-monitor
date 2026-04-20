type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export default function Card({ children, className = "", title }: Props) {
  return (
    <div className={`rounded-lg border border-slate-700/50 bg-slate-900 ${className}`}>
      {title && (
        <div className="border-b border-slate-700/50 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-300">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
