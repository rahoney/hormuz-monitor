"use client";

import { useEffect, useRef, useState } from "react";

type Section = {
  id: string;
  label: string;
};

type Props = {
  sections: Section[];
};

export default function MobileSectionNav({ sections }: Props) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-112px 0px -58% 0px",
        threshold: [0.05, 0.25, 0.5],
      }
    );

    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((target): target is HTMLElement => Boolean(target));

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const button = buttonRefs.current[activeId];
    button?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeId]);

  function jumpToSection(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (sections.length === 0) return null;

  return (
    <nav className="sticky top-14 z-40 -mx-4 -mt-6 mb-4 border-y border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur sm:-mt-8 md:hidden">
      <div className="mobile-section-scroll no-scrollbar flex w-full max-w-full gap-2 overflow-x-scroll overscroll-x-contain whitespace-nowrap">
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <button
              key={section.id}
              ref={(node) => {
                buttonRefs.current[section.id] = node;
              }}
              type="button"
              onClick={() => jumpToSection(section.id)}
              className={`shrink-0 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-blue-400 bg-blue-500/15 text-blue-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-100"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
