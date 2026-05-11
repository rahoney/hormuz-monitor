import type { Metadata } from "next";

export const SITE_URL = "https://www.hrmz.today";
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

type Locale = "ko" | "en";

type PageMetaInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
  keywords?: readonly string[];
  noIndex?: boolean;
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
  const normalizedLocale: Locale = locale === "ko" ? "ko" : "en";
  const canonicalPath = localizedPath(normalizedLocale, path);
  const url = `${SITE_URL}${canonicalPath}`;
  const englishPath = localizedPath("en", path);
  const koreanPath = localizedPath("ko", path);

  return {
    title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: {
      canonical: canonicalPath,
      languages: {
        en: englishPath,
        ko: koreanPath,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: normalizedLocale === "ko" ? "호르무즈 모니터" : "Hormuz Monitor",
      images: [{ url: OG_IMAGE_URL, width: 1734, height: 907, alt: title }],
      type: "website",
      locale: normalizedLocale === "ko" ? "ko_KR" : "en_US",
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
