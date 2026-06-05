import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Locale = "ko" | "en";

type EventRow = {
  id: number;
  event_date: string | null;
  event_type: string | null;
  title: string | null;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  published_at: string | null;
  severity: string | null;
};

type CachedSummaryRow = {
  event_id: number;
  source_url: string | null;
  locale: Locale;
  summary: string;
  model: string | null;
  created_at: string | null;
};

type GeminiResult = {
  text: string;
  model: string;
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-2.5-flash",
  "models/gemini-3-flash-preview",
];
const RETRY_STATUS_CODES = new Set([429, 500, 503, 504]);

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing Supabase server environment variables");
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
  const models = raw.split(",").map((model) => model.trim()).filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

function normalizeModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function retryDelayMs(attemptIndex: number, response?: Response): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds, 0), 30) * 1000;
    }
  }
  return Math.min(2000 * 2 ** attemptIndex, 20000) + Math.random() * 700;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prompt(event: EventRow, locale: Locale): string {
  const language = locale === "ko" ? "Korean" : "English";
  return `
You summarize a news item for a Hormuz Strait monitoring dashboard.

Rules:
- Write in ${language}.
- Use only the provided metadata and excerpt.
- Do not add facts, numbers, quotes, causes, or conclusions that are not present.
- Summarize the article content only.
- Do not say how the event is classified.
- Do not mention the event type, severity, source, URL, publication time, or provided metadata.
- Do not mention that information is missing.
- Keep it concise: 3 to 5 sentences.
- Do not include markdown.
- Return only one JSON object: {"summary":"..."}
- If strict JSON is not possible, return only the summary text and nothing else.

Article metadata:
Title: ${event.title ?? ""}
Source: ${event.source_name ?? ""}
Event type: ${event.event_type ?? ""}
Severity: ${event.severity ?? ""}
Published at: ${event.published_at ?? event.event_date ?? ""}
Existing excerpt/summary: ${event.summary ?? ""}
Original URL: ${event.source_url ?? ""}
`.trim();
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const content = (candidates[0] as { content?: { parts?: unknown } }).content;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" ? String((part as { text?: unknown }).text ?? "") : ""))
    .join("")
    .trim();
}

function finishReason(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const reason = (candidates[0] as { finishReason?: unknown }).finishReason;
  return reason ? String(reason) : null;
}

function parseSummary(text: string): string {
  let stripped = text.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const candidate = start >= 0 && start < end ? stripped.slice(start, end + 1) : stripped;
  try {
    const payload = JSON.parse(candidate) as { summary?: unknown };
    const summary = String(payload.summary ?? "").trim();
    if (summary) return summary.slice(0, 2000);
  } catch {
    // Plain text fallback is supported by the prompt and Python implementation.
  }

  if (!stripped) {
    throw new Error("empty article summary");
  }
  return stripped.slice(0, 2000);
}

async function generateText(articlePrompt: string): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  }

  const payload = {
    contents: [{ parts: [{ text: articlePrompt }] }],
    generationConfig: {
      maxOutputTokens: 420,
      temperature: 0.1,
    },
  };
  const failures: string[] = [];

  for (const model of summaryModels().map(normalizeModel)) {
    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      try {
        const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (RETRY_STATUS_CODES.has(response.status)) {
          failures.push(`${model} returned HTTP ${response.status}`);
          if (attemptIndex < 1) {
            await sleep(retryDelayMs(attemptIndex, response));
            continue;
          }
          break;
        }

        if (!response.ok) {
          failures.push(`${model} HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
          break;
        }

        const data = await response.json();
        const reason = finishReason(data);
        if (reason && reason !== "STOP") {
          failures.push(`${model} finishReason=${reason}`);
          break;
        }

        const text = extractText(data);
        if (text) {
          return { text, model };
        }
        failures.push(`${model} returned empty text`);
        break;
      } catch (error) {
        failures.push(`${model} ${error instanceof Error ? error.message : String(error)}`);
        if (attemptIndex < 1) {
          await sleep(retryDelayMs(attemptIndex));
          continue;
        }
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw new Error(`Gemini event_article_summary failed: ${failures.slice(-8).join(" | ")}`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const params = await context.params;
  const eventId = Number(params.eventId);
  const localeParam = new URL(request.url).searchParams.get("locale");
  const locale: Locale = localeParam === "ko" ? "ko" : "en";

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ detail: "invalid event id" }, { status: 400 });
  }

  try {
    const supabase = serviceClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,event_date,event_type,title,summary,source_name,source_url,published_at,severity")
      .eq("id", eventId)
      .single<EventRow>();

    if (eventError || !event) {
      return NextResponse.json({ detail: "event not found" }, { status: 404 });
    }

    const { data: cached } = await supabase
      .from("event_article_summaries")
      .select("event_id,source_url,locale,summary,model,created_at")
      .eq("event_id", eventId)
      .eq("locale", locale)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<CachedSummaryRow>();

    if (cached) {
      return NextResponse.json({ ...cached, event, cached: true });
    }

    const result = await generateText(prompt(event, locale));
    const summary = parseSummary(result.text);
    const record = {
      event_id: eventId,
      source_url: event.source_url,
      locale,
      summary,
      model: result.model,
    };

    const { error: upsertError } = await supabase
      .from("event_article_summaries")
      .upsert(record, { onConflict: "event_id,locale" });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ ...record, created_at: null, event, cached: false });
  } catch (error) {
    console.error("event article summary failed", error);
    return NextResponse.json({ detail: "article summary generation failed" }, { status: 502 });
  }
}
