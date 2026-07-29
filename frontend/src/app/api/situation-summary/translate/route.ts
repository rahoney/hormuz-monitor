import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const SECTION_TITLES: Record<string, [string, string, string, string]> = {
  ar: ["الوضع الرئيسي", "التحركات العسكرية والدبلوماسية", "رد فعل السوق", "الرؤية والنقاط المرتقبة"],
  fa: ["وضعیت اصلی", "تحرکات نظامی و دیپلماتیک", "واکنش بازار", "چشم‌انداز و نقاط کلیدی"],
  ja: ["主な状況", "軍事・外交の動き", "市場の反応", "見通しと注視ポイント"],
  es: ["Situación principal", "Movimientos militares y diplomáticos", "Reacción del mercado", "Perspectivas y puntos a vigilar"],
  tr: ["Ana Durum", "Askeri ve Diplomatik Hareketler", "Piyasa Tepkisi", "Görünüm ve Takip Noktaları"],
  de: ["Kernsituation", "Militärische & diplomatische Schritte", "Marktreaktion", "Ausblick & Beobachtungspunkte"],
  fr: ["Situation principale", "Mouvements militaires et diplomatiques", "Réaction du marché", "Perspectives et points clés"],
  "pt-BR": ["Situação principal", "Movimentos militares e diplomáticos", "Reação do mercado", "Perspectivas e pontos de atenção"],
  it: ["Situazione principale", "Mosse militari e diplomatiche", "Reazione del mercato", "Prospettive e punti chiave"],
  "zh-CN": ["核心局势", "军事与外交动态", "市场反应", "前景与关注要点"],
  "zh-TW": ["核心局勢", "軍事與外交動態", "市場反應", "前景與關注要點"],
  ru: ["Ключевая ситуация", "Военно-дипломатические шаги", "Реакция рынка", "Перспективы и контрольные точки"],
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

type StructuredSummary = {
  version: 1;
  sections: Array<{
    title: string;
    body: string;
    highlights: Array<{ text: string; tone: "risk" | "market" | "watch" }>;
  }>;
};

async function translateAndStructure(
  sourceStructured: StructuredSummary | null,
  sourceText: string,
  targetLocale: string
): Promise<{ summaryText: string; structuredData: StructuredSummary; model: string }> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  const targetLang = LOCALE_NAME_MAP[targetLocale] ?? "English";
  const titles = SECTION_TITLES[targetLocale] ?? ["Core situation", "Military and diplomatic moves", "Market reaction", "Outlook and watch points"];

  const prompt = `
Translate the following situation summary report into ${targetLang}.
You must produce a valid JSON object matching the structured schema below.

JSON Schema:
{
  "version": 1,
  "sections": [
    {
      "title": "${titles[0]}",
      "body": "Translated body paragraph for section 1",
      "highlights": [
        { "text": "exact sub-phrase in translated body", "tone": "risk" }
      ]
    },
    {
      "title": "${titles[1]}",
      "body": "Translated body paragraph for section 2",
      "highlights": [
        { "text": "exact sub-phrase in translated body", "tone": "watch" }
      ]
    },
    {
      "title": "${titles[2]}",
      "body": "Translated body paragraph for section 3",
      "highlights": [
        { "text": "exact sub-phrase in translated body", "tone": "market" }
      ]
    },
    {
      "title": "${titles[3]}",
      "body": "Translated body paragraph for section 4",
      "highlights": [
        { "text": "exact sub-phrase in translated body", "tone": "watch" }
      ]
    }
  ]
}

Rules:
- Translate accurately and naturally into ${targetLang}.
- Keep 4 sections exactly with the given section titles: "${titles[0]}", "${titles[1]}", "${titles[2]}", "${titles[3]}".
- In each section's "highlights", pick 1-3 key terms or short phrases that appear EXACTLY in that section's "body" string, with tone being one of "risk", "market", or "watch".
- Output strictly valid JSON with NO markdown code fences or conversational text.

Original Source Report:
${sourceStructured ? JSON.stringify(sourceStructured, null, 2) : sourceText}
`.trim();

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
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
      const rawJsonStr = candidates[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      if (!rawJsonStr) continue;

      const parsed: StructuredSummary = JSON.parse(rawJsonStr);
      if (parsed.version === 1 && Array.isArray(parsed.sections) && parsed.sections.length === 4) {
        const plainText = parsed.sections.map((s) => `- ${s.title}:\n${s.body}`).join("\n\n");
        return { summaryText: plainText, structuredData: parsed, model };
      }
    } catch {
      continue;
    }
  }

  throw new Error("Gemini structured translation failed across all models");
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

    // 신규 요약은 백엔드가 12개 번역을 모두 저장한 뒤에만 게시한다.
    // 과거 누락 데이터의 수동 복구가 꼭 필요한 경우에만 명시적으로 활성화한다.
    if (process.env.ALLOW_ON_DEMAND_SITUATION_TRANSLATION !== "true") {
      return NextResponse.json({ detail: "translation is not published" }, { status: 404 });
    }

    // 2. 원본 situation_summary 조회
    const { data: summaryRow } = await supabase
      .from("situation_summaries")
      .select("id,summary_en,summary_ko,summary_en_structured,summary_ko_structured")
      .eq("id", summaryId)
      .eq("is_published", true)
      .single();

    if (!summaryRow) {
      return NextResponse.json({ detail: "situation summary not found" }, { status: 404 });
    }

    const sourceStructured: StructuredSummary | null = summaryRow.summary_en_structured || summaryRow.summary_ko_structured;
    const sourceText = summaryRow.summary_en || summaryRow.summary_ko;

    if (!sourceText && !sourceStructured) {
      return NextResponse.json({ detail: "source text is empty" }, { status: 422 });
    }

    // 3. 단 1회 AI 호출로 구조화 번역 + 컬러 하이라이트 생성
    const { summaryText, structuredData, model } = await translateAndStructure(
      sourceStructured,
      sourceText,
      locale
    );

    // 4. DB 캐시에 저장
    const record = {
      summary_id: summaryId,
      locale,
      summary_text: summaryText,
      summary_structured: structuredData,
      model,
    };

    const { error: upsertError } = await supabase
      .from("situation_summary_translations")
      .upsert(record, { onConflict: "summary_id,locale" });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ ...record, cached: false });
  } catch (error) {
    console.error("situation summary translation failed", error);
    return NextResponse.json({ detail: "translation failed" }, { status: 502 });
  }
}
