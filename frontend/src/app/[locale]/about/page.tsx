import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import { makePageMetadata } from "@/lib/seo";

const META = {
  ko: {
    title: "호르무즈 모니터 소개 | 선박 통행, 유가, 시장, 관련 이슈 대시보드",
    description: "호르무즈 해협 상황, 선박 통행량, 미국과 한국 주식 시장 지표, 브렌트유·WTI, 천연가스와 미국-이란 이슈 대시보드.",
    keywords: ["호르무즈 모니터", "호르무즈 해협 모니터", "호르무즈 해협 트래커", "호르무즈 해협 지도", "호르무즈 해협 실시간 상황", "트럼프 SNS"],
  },
  en: {
    title: "About Hormuz Monitor | Vessel Traffic, Oil, Markets, and Issues Dashboard",
    description: "Hormuz Monitor is a personal dashboard project for tracking Strait of Hormuz live conditions, vessel traffic, oil prices, U.S. gasoline prices, stock markets, related news, and Trump social posts.",
    keywords: ["Hormuz Monitor", "Strait of Hormuz monitor", "Hormuz tracker", "Strait of Hormuz map", "Strait of Hormuz live status", "Trump social"],
  },
} as const;

type MetadataProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const meta = locale === "ko" ? META.ko : META.en;
  return makePageMetadata({ locale, path: "/about", title: meta.title, description: meta.description, keywords: meta.keywords });
}

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <PageShell>
      <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-semibold text-slate-100">{t("title")}</h1>

        {/* 소개글 */}
        <section className="flex flex-col gap-3">
          <p className="text-base text-slate-200 leading-7">{t("description.p1")}</p>
          <p className="text-base text-slate-200 leading-7">{t("description.p2")}</p>
          <p className="text-base text-slate-200 leading-7">{t("description.p3")}</p>
          <p className="text-base text-slate-200 leading-7">{t("description.p4")}</p>
        </section>

        {/* 데이터 출처 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-200">{t("sources.heading")}</h2>
          <p className="text-base text-slate-300 leading-6">{t("sources.list")}</p>
        </section>

        {/* GitHub */}
        <section className="flex items-center gap-3 flex-wrap">
          <a
            href="https://github.com/rahoney/hormuz-monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-8 rounded border border-blue-700 px-4 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <a
            href="https://github.com/sponsors/rahoney"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-8 rounded border border-blue-700 px-4 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
          >
            ♥ Sponsor
          </a>
        </section>

        {/* 문의 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-200">{t("contact.heading")}</h2>
          <p className="text-base text-slate-300 leading-6">{t("contact.body")}</p>
          <Link
            href="/contact"
            className="inline-block w-fit rounded border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-400 hover:text-white transition-colors"
          >
            {t("contact.button")}
          </Link>
        </section>

        {/* 후원 */}
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-200">{t("support.heading")}</h2>
          <p className="text-base text-slate-300 leading-6">{t("support.body1")}</p>
          <p className="text-base text-slate-300 leading-6">{t("support.body2")}</p>
          <div className="flex gap-3 mt-1">
            <a
              href="https://ctee.kr/place/wikihoney"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-blue-700 px-4 py-2 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
            >
              {t("support.kr")}
            </a>
            <a
              href="https://ko-fi.com/wikihoney"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-blue-700 px-4 py-2 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
            >
              {t("support.global")}
            </a>
          </div>
        </section>

        {/* 안내 */}
        <section className="flex flex-col gap-1 border-t border-slate-800 pt-6">
          <h2 className="text-base font-semibold text-slate-200">{t("notice.heading")}</h2>
          <p className="text-base text-slate-300">{t("notice.body")}</p>
          <p className="text-base text-teal-400 mt-3 text-center w-full">{t("notice.peace")}</p>
        </section>

      </div>
    </PageShell>
  );
}
