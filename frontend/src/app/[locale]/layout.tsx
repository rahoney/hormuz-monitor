import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const META = {
  ko: {
    title: "호르무즈 모니터",
    description: "해협 상황을 한눈에 파악할 수 있도록 주요 정보를 한 곳에 모았습니다.",
  },
  en: {
    title: "Hormuz Monitor",
    description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
  },
} as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const meta = locale === "ko" ? META.ko : META.en;
  const path = locale === "ko" ? "/ko" : "/en";

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: path,
      languages: {
        ko: "/ko",
        en: "/en",
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: path,
      siteName: meta.title,
      images: [{ url: "/og-image.png", width: 1734, height: 907, alt: meta.title }],
      type: "website",
      locale: locale === "ko" ? "ko_KR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-image.png"],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
