"use client";

type Section = {
  id: string;
  label: string;
};

type Props = {
  label: string;
  sections: Section[];
};

export default function SectionJumpSelect({ label, sections }: Props) {
  return (
    <div className="fixed right-4 top-16 z-40 hidden w-fit rounded-md border border-slate-700/60 bg-slate-950/90 p-1.5 shadow-lg shadow-black/20 backdrop-blur md:block lg:right-6">
      <label className="sr-only">{label}</label>
      <select
        aria-label={label}
        className="h-8 w-36 shrink-0 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 sm:w-44"
        defaultValue=""
        onChange={(event) => {
          const targetId = event.target.value;
          if (!targetId) return;
          document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
          event.target.value = "";
        }}
      >
        <option value="" disabled>
          {label}
        </option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
      </select>
    </div>
  );
}
