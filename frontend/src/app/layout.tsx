import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://hormuz-monitor.vercel.app"),
  title: "Hormuz Monitor",
  description: "Real-time Hormuz Strait vessel traffic, oil prices, and geopolitical intelligence",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "Hormuz Monitor",
    description: "Real-time Hormuz Strait vessel traffic, oil prices, and geopolitical intelligence",
    url: "/",
    siteName: "Hormuz Monitor",
    images: [{ url: "/og-image.png", width: 1734, height: 907, alt: "Hormuz Monitor" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hormuz Monitor",
    description: "Real-time Hormuz Strait vessel traffic, oil prices, and geopolitical intelligence",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased bg-[#0b0f1a] text-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
