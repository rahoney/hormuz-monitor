"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { routing, LOCALE_LABELS } from "@/i18n/routing";

const NAV_ITEMS = [
  { key: "dashboard", href: "/" },
  { key: "events", href: "/events" },
  { key: "about", href: "/about" },
] as const;

export default function Header() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(locale: string) {
    router.push(pathname, { locale });
    setLangOpen(false);
    setMenuOpen(false);
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 text-slate-100 hover:text-white">
          <Image src="/logo.jpg" alt="Hormuz Monitor" width={41} height={32} className="h-8 w-auto rounded" />
          <span className="text-xl font-bold tracking-wider uppercase text-amber-400">Hormuz Monitor</span>
        </Link>

        {/* 데스크톱 내비게이션 */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                isActive(href)
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>

        {/* 언어 드롭다운 + 모바일 메뉴 버튼 */}
        <div className="flex items-center gap-2">
          {/* 언어 선택 드롭다운 */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              aria-label="Select language"
              aria-expanded={langOpen}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
              </svg>
              <span>{LOCALE_LABELS[currentLocale] ?? currentLocale}</span>
              <svg className={`h-3 w-3 transition-transform ${langOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {langOpen && (
              <div className="absolute end-0 top-full z-50 mt-1 max-h-72 w-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                {routing.locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs transition-colors ${
                      currentLocale === loc
                        ? "bg-slate-700/50 text-amber-400"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    {LOCALE_LABELS[loc] ?? loc}
                    {currentLocale === loc && (
                      <svg className="ms-auto h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="rounded p-1.5 text-slate-400 hover:text-slate-100 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴 열기"
          >
            <span className="block h-4 w-5 text-center leading-none">
              {menuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <nav className="border-t border-slate-700/50 bg-slate-950 px-4 py-2 md:hidden">
          {NAV_ITEMS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded px-3 py-2 text-sm transition-colors ${
                isActive(href)
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
