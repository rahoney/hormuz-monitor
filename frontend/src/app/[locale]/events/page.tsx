import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import EventsPageClient from "@/components/cards/EventsPageClient";
import { supabase } from "@/lib/supabase";
import type { Event, TrumpPost } from "@/types";
import { makePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const META = {
  ko: {
    title: "호르무즈 관련 이슈 | 미국-이란 전쟁, 트럼프 SNS, 유가 영향",
    description: "호르무즈 해협과 이란 전쟁 현황, 미국-이란 갈등, 트럼프 Truth Social 발언, 유가와 시장 영향 관련 이슈를 모아 AI 요약과 번역으로 확인할 수 있습니다.",
    keywords: [
      "호르무즈 관련 이슈",
      "호르무즈 해협 트래커",
      "호르무즈 해협 지도",
      "호르무즈 해협 실시간 상황",
      "미국 이란 전쟁 상황",
      "이란 전쟁 현황",
      "트럼프 SNS",
      "트루 소셜",
      "트럼프 소셜 미디어",
      "유가 영향",
      "미국 이란 전쟁 주식",
    ],
  },
  en: {
    title: "Hormuz Related Issues | U.S.-Iran Conflict, Trump Social, Oil Impact",
    description: "Track Strait of Hormuz related issues, U.S.-Iran conflict updates, Trump Truth Social posts, oil market impact, and AI article summaries in one page.",
    keywords: [
      "Hormuz related issues",
      "U.S. Iran conflict news",
      "Trump Truth Social",
      "oil market impact",
      "geopolitical news",
      "AI article summaries",
    ],
  },
} as const;

type MetadataProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const meta = locale === "ko" ? META.ko : META.en;
  return makePageMetadata({ locale, path: "/events", title: meta.title, description: meta.description, keywords: meta.keywords });
}

const QUERY_TIMEOUT_MS = 8000;

async function withAbortSignal<T>(
  query: (signal: AbortSignal) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const { data } = await query(controller.signal);
    return data ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllEvents(): Promise<Event[]> {
  return withAbortSignal((signal) =>
    supabase
      .from("events")
      .select("id, event_date, published_at, event_type, title, summary, source_name, source_url, severity")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200)
      .abortSignal(signal)
  );
}

async function fetchAllTrumpPosts(): Promise<TrumpPost[]> {
  return withAbortSignal((signal) =>
    supabase
      .from("trump_posts")
      .select("id, post_date, posted_at, content, content_ko, source_url, source_name")
      .order("post_date", { ascending: false })
      .limit(100)
      .abortSignal(signal)
  );
}

export default async function EventsPage() {
  const [events, trumpPosts] = await Promise.allSettled([
    fetchAllEvents(),
    fetchAllTrumpPosts(),
  ]);

  return (
    <PageShell>
      <EventsPageClient
        events={events.status === "fulfilled" ? events.value : []}
        trumpPosts={trumpPosts.status === "fulfilled" ? trumpPosts.value : []}
      />
    </PageShell>
  );
}
