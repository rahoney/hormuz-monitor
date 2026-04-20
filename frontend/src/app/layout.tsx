import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hormuz Monitor",
  description: "Real-time Hormuz Strait vessel traffic and market intelligence",
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
