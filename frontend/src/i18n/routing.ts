import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: [
    "en", "ko", "ar", "fa", "ja", "es", "tr",
    "de", "fr", "pt-BR", "it", "zh-CN", "zh-TW", "ru",
  ],
  defaultLocale: "en",
});

/** RTL 언어 목록 (아랍어, 페르시아어) */
export const RTL_LOCALES = new Set(["ar", "fa"]);

/** 언어 표시 라벨 (드롭다운용) */
export const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ar: "العربية",
  fa: "فارسی",
  ja: "日本語",
  es: "Español",
  tr: "Türkçe",
  de: "Deutsch",
  fr: "Français",
  "pt-BR": "Português",
  it: "Italiano",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ru: "Русский",
};
