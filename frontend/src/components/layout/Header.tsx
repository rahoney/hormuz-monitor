"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAV_ITEMS = [
  { key: "dashboard", href: "/" },
  { key: "events", href: "/events" },
  { key: "about", href: "/about" },
  { key: "sources", href: "/sources" },
] as const;

export default function Header() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLocale = routing.locales.find((loc) =>
    pathname.startsWith(`/${loc}`)
  ) ?? routing.defaultLocale;

  function switchLocale(locale: string) {
    const pathWithoutLocale = pathname.replace(/^\/(en|ko)/, "") || "/";
    router.push(pathWithoutLocale, { locale });
    setMenuOpen(false);
  }

  function isActive(href: string) {
    const pathWithoutLocale = pathname.replace(/^\/(en|ko)/, "") || "/";
    return href === "/" ? pathWithoutLocale === "/" : pathWithoutLocale.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 text-slate-100 hover:text-white">
          <span className="text-blue-400">◈</span>
          <span className="font-semibold tracking-tight">Hormuz Monitor</span>
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

        {/* 언어 전환 + 모바일 메뉴 버튼 */}
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-700 text-xs">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                className={`px-2.5 py-1 transition-colors first:rounded-l last:rounded-r ${
                  currentLocale === loc
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
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
