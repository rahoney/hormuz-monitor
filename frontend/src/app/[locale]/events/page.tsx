import PageShell from "@/components/layout/PageShell";
import EventsPageClient from "@/components/cards/EventsPageClient";
import { supabase } from "@/lib/supabase";
import type { Event, TrumpPost } from "@/types";

export const dynamic = "force-dynamic";

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
