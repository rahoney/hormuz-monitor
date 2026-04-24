type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function PageShell({ children, className = "" }: Props) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${className}`}>
      {children}
    </div>
  );
}
