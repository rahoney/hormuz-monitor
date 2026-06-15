import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import BrowserProtection from "@/components/system/BrowserProtection";
import { OG_IMAGE_URL, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Hormuz Monitor",
      alternateName: "호르무즈 모니터",
      inLanguage: ["ko", "en"],
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Hormuz Monitor",
  description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased bg-[#0b0f1a] text-slate-100" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <BrowserProtection />
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
