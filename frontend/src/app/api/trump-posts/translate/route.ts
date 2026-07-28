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

async function translatePost(text: string, targetLocale: string): Promise<{ translatedText: string; model: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  const targetLang = LOCALE_NAME_MAP[targetLocale] ?? "English";
  const prompt = `
Translate the following social media post into ${targetLang}.

Rules:
- Preserve @mentions, URLs, and proper names exactly as they are.
- Keep the exact tone and meaning.
- Output ONLY the translated post text, with no explanations or intros.

Post text:
${text}
`.trim();

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1024,
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

  throw new Error("Gemini post translation failed across all models");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postId = Number(searchParams.get("post_id"));
  const locale = searchParams.get("locale") ?? "";

  if (!Number.isInteger(postId) || postId <= 0 || !LOCALE_NAME_MAP[locale]) {
    return NextResponse.json({ detail: "invalid post_id or locale" }, { status: 400 });
  }

  try {
    const supabase = serviceClient();

    // 1. DB 캐시 확인 (0 토큰)
    const { data: cached } = await supabase
      .from("trump_post_translations")
      .select("post_id,locale,content_translated,model,created_at")
      .eq("post_id", postId)
      .eq("locale", locale)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 2. 원본 트럼프 포스트 조회 (영어 원문 우선, 없으면 한국어)
    const { data: postRow } = await supabase
      .from("trump_posts")
      .select("id,content,content_ko")
      .eq("id", postId)
      .single();

    if (!postRow) {
      return NextResponse.json({ detail: "trump post not found" }, { status: 404 });
    }

    const sourceText = postRow.content || postRow.content_ko;
    if (!sourceText) {
      return NextResponse.json({ detail: "source content is empty" }, { status: 422 });
    }

    // 3. 온디맨드 AI 번역 수행
    const { translatedText, model } = await translatePost(sourceText, locale);

    // 4. DB 캐시에 저장
    const record = {
      post_id: postId,
      locale,
      content_translated: translatedText,
      model,
    };

    const { error: upsertError } = await supabase
      .from("trump_post_translations")
      .upsert(record, { onConflict: "post_id,locale" });

    if (upsertError) {
      console.error("upsert error:", upsertError);
    }

    return NextResponse.json({ ...record, cached: false });
  } catch (error) {
    console.error("trump post translation failed", error);
    return NextResponse.json({ detail: "post translation failed" }, { status: 502 });
  }
}
