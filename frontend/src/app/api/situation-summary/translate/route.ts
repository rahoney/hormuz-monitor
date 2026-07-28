import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Locale =
  | "ar"
  | "fa"
  | "ja"
  | "es"
  | "tr"
  | "de"
  | "fr"
  | "pt-BR"
  | "it"
  | "zh-CN"
  | "zh-TW"
  | "ru";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-2.5-flash",
  "models/gemini-3-flash-preview",
];

const LOCALE_NAME_MAP: Record<string, string> = {
  ar: "Arabic",
  fa: "Persian",
  ja: "Japanese",
  es: "Spanish",
  tr: "Turkish",
  de: "German",
  fr: "French",
  "pt-BR": "Brazilian Portuguese",
  it: "Italian",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  ru: "Russian",
};

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing Supabase environment variables");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

function summaryModels(): string[] {
  const raw = process.env.ARTICLE_SUMMARY_MODELS ?? "";
  const models = raw.split(",").map((m) => m.trim()).filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

function normalizeModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

async function translateText(text: string, targetLocale: string): Promise<{ translatedText: string; model: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  const targetLang = LOCALE_NAME_MAP[targetLocale] ?? "English";
  const prompt = `
Translate the following situation summary report into ${targetLang}.

Rules:
- Preserve the exact bullet labels and structure if any.
- Do not add or remove facts or statements.
- Translate accurately and naturally into ${targetLang}.
- Keep formatting clean with no extra titles.

Original Text:
${text}
`.trim();

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.1,
    },
  };

  for (const model of summaryModels().map(normalizeModel)) {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const candidates = data?.candidates;
      if (!Array.isArray(candidates) || candidates.length === 0) continue;
      const parts = candidates[0]?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) continue;
      const translatedText = parts.map((p: any) => p.text || "").join("").trim();
      if (translatedText) {
        return { translatedText, model };
      }
    } catch {
      continue;
    }
  }

  throw new Error("Gemini translation failed across all models");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summaryId = Number(searchParams.get("summary_id"));
  const locale = searchParams.get("locale") ?? "";

  if (!Number.isInteger(summaryId) || summaryId <= 0 || !LOCALE_NAME_MAP[locale]) {
    return NextResponse.json({ detail: "invalid summary_id or locale" }, { status: 400 });
  }

  try {
    const supabase = serviceClient();

    // 1. situation_summary_translations 캐시 테이블 확인 (0 토큰 사용)
    const { data: cached } = await supabase
      .from("situation_summary_translations")
      .select("summary_id,locale,summary_text,summary_structured,model,created_at")
      .eq("summary_id", summaryId)
      .eq("locale", locale)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 2. 원본 situation_summary 조회 (영어 원문 우선, 없으면 한국어)
    const { data: summaryRow } = await supabase
      .from("situation_summaries")
      .select("id,summary_en,summary_ko,summary_en_structured,summary_ko_structured")
      .eq("id", summaryId)
      .single();

    if (!summaryRow) {
      return NextResponse.json({ detail: "situation summary not found" }, { status: 404 });
    }

    const sourceText = summaryRow.summary_en || summaryRow.summary_ko;
    if (!sourceText) {
      return NextResponse.json({ detail: "source text is empty" }, { status: 422 });
    }

    // 3. 온디맨드 AI 번역 수행
    const { translatedText, model } = await translateText(sourceText, locale);

    // 4. DB 캐시에 저장
    const record = {
      summary_id: summaryId,
      locale,
      summary_text: translatedText,
      summary_structured: null,
      model,
    };

    const { error: upsertError } = await supabase
      .from("situation_summary_translations")
      .upsert(record, { onConflict: "summary_id,locale" });

    if (upsertError) {
      console.error("upsert error:", upsertError);
    }

    return NextResponse.json({ ...record, cached: false });
  } catch (error) {
    console.error("situation summary translation failed", error);
    return NextResponse.json({ detail: "translation failed" }, { status: 502 });
  }
}
