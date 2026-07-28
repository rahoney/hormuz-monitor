import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { routing } from "@/i18n/routing";

const ROUTES = ["", "/events", "/about", "/sources"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const locales = routing.locales as readonly string[];

  return locales.flatMap((locale) =>
    ROUTES.map((route) => {
      const languageAlternates: Record<string, string> = {};
      locales.forEach((l) => {
        languageAlternates[l] = `${SITE_URL}/${l}${route}`;
      });
      languageAlternates["x-default"] = `${SITE_URL}/en${route}`;

      return {
        url: `${SITE_URL}/${locale}${route}`,
        lastModified: now,
        changeFrequency: route === "" ? "hourly" : "daily",
        priority: route === "" ? 1 : route === "/events" ? 0.8 : 0.6,
        alternates: {
          languages: languageAlternates,
        },
      };
    })
  );
}
