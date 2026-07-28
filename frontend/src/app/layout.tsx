import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { getLocale } from "next-intl/server";
import BrowserProtection from "@/components/system/BrowserProtection";
import { OG_IMAGE_URL, SITE_URL } from "@/lib/seo";
import { RTL_LOCALES } from "@/i18n/routing";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const clarityId = "xpwhae7dv0";
const adsenseClient = "ca-pub-1366941829083043";
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Hormuz Monitor",
      alternateName: "호르무즈 모니터",
      inLanguage: [
        "en", "ko", "ar", "fa", "ja", "es", "tr",
        "de", "fr", "pt-BR", "it", "zh-CN", "zh-TW", "ru",
      ],
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Hormuz Monitor",
      alternateName: "호르무즈 모니터",
      description: "A personally operated dashboard for monitoring the Strait of Hormuz.",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.jpg`,
      },
      sameAs: ["https://github.com/rahoney/hormuz-monitor"],
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  // locale → content-language 매핑 (BCP-47)
  const CONTENT_LANG_MAP: Record<string, string> = {
    ko: "ko-KR", en: "en-US", ar: "ar", fa: "fa-IR", ja: "ja-JP",
    es: "es", tr: "tr-TR", de: "de-DE", fr: "fr-FR",
    "pt-BR": "pt-BR", it: "it-IT", "zh-CN": "zh-CN", "zh-TW": "zh-TW", ru: "ru-RU",
  };
  const contentLanguage = CONTENT_LANG_MAP[locale] ?? "en-US";

  return {
    metadataBase: new URL(SITE_URL),

    title: "Hormuz Monitor",
    description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
    other: {
      "content-language": contentLanguage,
    },
    verification: {
      other: {
        "naver-site-verification": "28c96a0d8d92c8b434de480085bd254369fa1bd9",
      },
    },
    icons: {
      icon: "/logo.jpg",
      apple: "/logo.jpg",
    },
    openGraph: {
      title: "Hormuz Monitor",
      description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
      url: SITE_URL,
      siteName: "Hormuz Monitor",
      images: [{ url: OG_IMAGE_URL, width: 1734, height: 907, alt: "Hormuz Monitor" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Hormuz Monitor",
      description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
      images: [OG_IMAGE_URL],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased bg-[#0b0f1a] text-slate-100" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <BrowserProtection />
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
