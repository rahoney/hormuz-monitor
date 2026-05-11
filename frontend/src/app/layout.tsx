import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import BrowserProtection from "@/components/system/BrowserProtection";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const siteUrl = "https://www.hrmz.today";
const ogImageUrl = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Hormuz Monitor",
  description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "Hormuz Monitor",
    description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
    url: siteUrl,
    siteName: "Hormuz Monitor",
    images: [{ url: ogImageUrl, width: 1734, height: 907, alt: "Hormuz Monitor" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hormuz Monitor",
    description: "Key information is gathered in one place so you can assess the strait situation at a glance.",
    images: [ogImageUrl],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased bg-[#0b0f1a] text-slate-100" suppressHydrationWarning>
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
