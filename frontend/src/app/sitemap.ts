import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const ROUTES = ["", "/events", "/about", "/sources"] as const;
const LOCALES = ["ko", "en"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return LOCALES.flatMap((locale) =>
    ROUTES.map((route) => ({
      url: `${SITE_URL}/${locale}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? "hourly" : "daily",
      priority: route === "" ? 1 : route === "/events" ? 0.8 : 0.6,
    }))
  );
}
