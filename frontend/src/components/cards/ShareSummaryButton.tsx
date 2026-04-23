"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

type Props = { text: string };

const SERVICE_URL = "https://hormuz-monitor.vercel.app";

export default function ShareSummaryButton({ text }: Props) {
  const t = useTranslations("dashboard.summary");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const shareText = `[${t("shareSource")}]\n${text}\n${SERVICE_URL}`;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const webShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t("shareService"), text: shareText, url: SERVICE_URL }); }
      catch { /* cancelled */ }
    } else {
      await copy();
    }
    setOpen(false);
  };

  const enc = encodeURIComponent(shareText);
  const encUrl = encodeURIComponent(SERVICE_URL);
  const encTitle = encodeURIComponent(text.slice(0, 100));

  const targets = [
    { label: "URL 복사", icon: "📋", href: null, onClick: copy },
    { label: "Twitter / X",  icon: "𝕏",  href: `https://twitter.com/intent/tweet?text=${enc}` },
    { label: "Facebook",     icon: "f",   href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${enc}` },
    { label: "LinkedIn",     icon: "in",  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}` },
    { label: "Reddit",       icon: "r/",  href: `https://www.reddit.com/submit?url=${encUrl}&title=${encTitle}` },
    { label: "WhatsApp",     icon: "W",   href: `https://wa.me/?text=${enc}` },
  ] as const;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${
          copied
            ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-400"
            : "border-blue-600/60 bg-blue-900/20 text-blue-400 hover:border-blue-500 hover:bg-blue-900/40 hover:text-blue-200"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
        </svg>
        {copied ? t("shareCopied") : t("share")}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl py-1">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={webShare}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-5 text-center text-slate-400">↗</span>
              Share…
            </button>
          )}
          {targets.map((target) => (
            <button
              key={target.label}
              onClick={async () => {
                if ("onClick" in target && target.onClick) {
                  await target.onClick();
                } else if ("href" in target && target.href) {
                  window.open(target.href, "_blank", "noopener,noreferrer");
                  setOpen(false);
                }
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-5 text-center text-xs font-bold text-slate-400">{target.icon}</span>
              {target.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
