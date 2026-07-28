import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export const SITE_URL = "https://www.hrmz.today";
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

type PageMetaInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
  keywords?: readonly string[];
  noIndex?: boolean;
};

const OG_LOCALE_MAP: Record<string, string> = {
  ko: "ko_KR",
  en: "en_US",
  ar: "ar_AR",
  fa: "fa_IR",
  ja: "ja_JP",
  es: "es_ES",
  tr: "tr_TR",
  de: "de_DE",
  fr: "fr_FR",
  "pt-BR": "pt_BR",
  it: "it_IT",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  ru: "ru_RU",
};

export function localizedPath(locale: string, path = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function makePageMetadata({
  locale,
  path,
  title,
  description,
  keywords,
  noIndex = false,
}: PageMetaInput): Metadata {
  const currentLocale = routing.locales.includes(locale as any)
    ? locale
    : routing.defaultLocale;
  const canonicalPath = localizedPath(currentLocale, path);
  const url = `${SITE_URL}${canonicalPath}`;

  // 14개 언어에 대한 hreflang (alternates.languages) 객체 동적 생성
  const languageAlternates: Record<string, string> = {};
  for (const loc of routing.locales) {
    languageAlternates[loc] = localizedPath(loc, path);
  }
  // x-default 경로 (defaultLocale: en)
  languageAlternates["x-default"] = localizedPath(routing.defaultLocale, path);

  return {
    title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: {
      canonical: canonicalPath,
      languages: languageAlternates,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: currentLocale === "ko" ? "호르무즈 모니터" : "Hormuz Monitor",
      images: [{ url: OG_IMAGE_URL, width: 1734, height: 907, alt: title }],
      type: "website",
      locale: OG_LOCALE_MAP[currentLocale] ?? "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_URL],
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
