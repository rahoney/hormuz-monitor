type Props = {
  children: React.ReactNode;
  className?: string;
  id?: string;
  title?: string;
};

export default function Card({ children, className = "", id, title }: Props) {
  return (
    <div id={id} className={`rounded-lg border border-slate-700/50 bg-slate-900 ${className}`}>
      {title && (
        <div className="border-b border-slate-700/50 px-4 py-4">
          <h2 className="inline-block rounded-md border-2 border-blue-400 px-3 py-1 text-lg font-bold text-white">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
