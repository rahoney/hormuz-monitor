import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODELS = [
  "models/gemini-3.5-flash-lite",
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.5-flash",
];
const MAX_BATCH_SIZE = 20;

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

type SourcePost = { id: number; text: string };
type TranslationResult = { postId: number; translatedText: string; model: string };
const inFlightTranslations = new Map<string, Promise<TranslationResult[]>>();

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing Supabase environment variables");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

function summaryModels(): string[] {
  const raw = process.env.ARTICLE_SUMMARY_MODELS ?? "";
  const models = raw.split(",").map((model) => model.trim()).filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

function normalizeModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function batchSchema() {
  return {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            post_id: { type: "integer" },
            content_translated: { type: "string" },
          },
          required: ["post_id", "content_translated"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  };
}

async function translatePosts(posts: SourcePost[], locale: string): Promise<TranslationResult[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not set");

  const targetLanguage = LOCALE_NAME_MAP[locale] ?? "English";
  const prompt = `
Translate every supplied Truth Social post into ${targetLanguage}.

Rules:
- Preserve @mentions, URLs, proper names, meaning, and tone.
- Return exactly one translation for each input post_id and no additional post_id.
- Output only the JSON response required by the schema.

Posts:
${JSON.stringify(posts)}
`.trim();
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      responseJsonSchema: batchSchema(),
    },
  };
  const expectedIds = new Set(posts.map((post) => post.id));

  for (const model of summaryModels().map(normalizeModel)) {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: unknown }) => String(part?.text ?? ""))
        .join("")
        .trim();
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as { translations?: unknown };
      if (!Array.isArray(parsed.translations)) continue;
      const results: TranslationResult[] = [];
      const seen = new Set<number>();
      for (const item of parsed.translations) {
        if (!item || typeof item !== "object") continue;
        const row = item as { post_id?: unknown; content_translated?: unknown };
        if (typeof row.post_id !== "number" || !expectedIds.has(row.post_id) || seen.has(row.post_id)) continue;
        if (typeof row.content_translated !== "string" || !row.content_translated.trim()) continue;
        seen.add(row.post_id);
        results.push({ postId: row.post_id, translatedText: row.content_translated.trim(), model });
      }
      return results;
    } catch {
      continue;
    }
  }
  throw new Error("Gemini post batch translation failed across all models");
}

async function translatePostsSingleFlight(posts: SourcePost[], locale: string): Promise<TranslationResult[]> {
  const key = `${locale}:${posts.map((post) => post.id).sort((a, b) => a - b).join(",")}`;
  const existing = inFlightTranslations.get(key);
  if (existing) return existing;
  const pending = translatePosts(posts, locale);
  inFlightTranslations.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlightTranslations.get(key) === pending) inFlightTranslations.delete(key);
  }
}

function requestedPostIds(searchParams: URLSearchParams): number[] {
  const raw = searchParams.get("post_ids") ?? searchParams.get("post_id") ?? "";
  const ids = [...new Set(raw.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  return ids.slice(0, MAX_BATCH_SIZE);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postIds = requestedPostIds(searchParams);
  const locale = searchParams.get("locale") ?? "";
  if (postIds.length === 0 || !LOCALE_NAME_MAP[locale]) {
    return NextResponse.json({ detail: "invalid post_id(s) or locale" }, { status: 400 });
  }

  try {
    const supabase = serviceClient();
    const { data: cachedRows, error: cachedError } = await supabase
      .from("trump_post_translations")
      .select("post_id,locale,content_translated,model,created_at")
      .in("post_id", postIds)
      .eq("locale", locale);
    if (cachedError) throw cachedError;

    const cachedById = new Map((cachedRows ?? []).map((row) => [row.post_id, row]));
    const missingIds = postIds.filter((postId) => !cachedById.has(postId));
    let freshRows: Array<{ post_id: number; locale: string; content_translated: string; model: string }> = [];

    if (missingIds.length > 0) {
      const { data: postRows, error: postError } = await supabase
        .from("trump_posts")
        .select("id,content,content_ko")
        .in("id", missingIds);
      if (postError) throw postError;

      const sourcePosts: SourcePost[] = (postRows ?? [])
        .map((post) => ({ id: post.id, text: post.content || post.content_ko || "" }))
        .filter((post) => post.text.length > 0);
      const translations = sourcePosts.length > 0
        ? await translatePostsSingleFlight(sourcePosts, locale)
        : [];
      freshRows = translations.map((translation) => ({
        post_id: translation.postId,
        locale,
        content_translated: translation.translatedText,
        model: translation.model,
      }));
      if (freshRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("trump_post_translations")
          .upsert(freshRows, { onConflict: "post_id,locale" });
        if (upsertError) throw upsertError;
      }
    }

    const freshById = new Map(freshRows.map((row) => [row.post_id, row]));
    const translations = postIds
      .map((postId) => freshById.get(postId) ?? cachedById.get(postId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    return NextResponse.json({ translations, cached: freshRows.length === 0 });
  } catch (error) {
    console.error("trump post batch translation failed", error);
    return NextResponse.json({ detail: "post translation failed" }, { status: 502 });
  }
}
