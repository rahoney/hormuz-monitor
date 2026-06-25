import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { makePageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const META = {
  ko: {
    title: "호르무즈 해협 실시간 모니터 | 위험 지수, 선박 통행, 유가",
    description: "호르무즈 해협 상황, 봉쇄 가능성, 미국-이란 전쟁 현황, 선박 통행량, WTI·브렌트유, 미국 휘발유 가격과 주요 시장 지표를 한눈에 확인하는 실시간 대시보드입니다.",
  },
  en: {
    title: "Strait of Hormuz Real-Time Monitor | Risk Index, Vessel Traffic, Oil Prices",
    description: "Monitor Strait of Hormuz risk, vessel traffic, oil prices, U.S.-Iran conflict updates, market indicators, and related geopolitical issues in one real-time dashboard.",
  },
} as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const meta = locale === "ko" ? META.ko : META.en;

  return makePageMetadata({ locale, path: "/", title: meta.title, description: meta.description });
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
