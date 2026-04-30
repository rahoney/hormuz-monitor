"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAV_ITEMS = [
  { key: "dashboard", href: "/" },
  { key: "events", href: "/events" },
  { key: "about", href: "/about" },
] as const;

export default function Header() {
  const t = useTranslations("common");
  const dashboardT = useTranslations("dashboard");
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

  const pathWithoutLocale = pathname.replace(/^\/(en|ko)/, "") || "/";
  const showDashboardSections = pathWithoutLocale === "/";
  const dashboardSections = [
    { id: "summary", label: dashboardT("sections.summary") },
    { id: "risk", label: dashboardT("gauge.title") },
    { id: "weekly-transit", label: dashboardT("sections.weeklyTransit") },
    { id: "map", label: dashboardT("sections.map") },
    { id: "transit-flow", label: dashboardT("sections.transitFlow") },
    { id: "oil", label: dashboardT("sections.oilRealtime") },
    { id: "gasoline", label: dashboardT("gasoline.title") },
    { id: "market", label: dashboardT("sections.marketSnapshot") },
    { id: "events", label: dashboardT("sections.recentEvents") },
    { id: "trump", label: dashboardT("trump.title") },
  ];

  function jumpToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
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

        {/* 언어 전환 + 모바일 메뉴 버튼 */}
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-700 text-xs">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                className={`cursor-pointer px-2.5 py-1 transition-colors first:rounded-l last:rounded-r ${
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
          {showDashboardSections && (
            <div className="mt-2 border-t border-slate-700/50 pt-2">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dashboardT("sections.jump")}
              </div>
              {dashboardSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpToSection(section.id)}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
