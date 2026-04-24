import PageShell from "@/components/layout/PageShell";
import EventsPageClient from "@/components/cards/EventsPageClient";
import { supabase } from "@/lib/supabase";
import type { Event, TrumpPost } from "@/types";

async function fetchAllEvents(): Promise<Event[]> {
  const { data } = await supabase
    .from("events")
    .select("id, event_date, published_at, event_type, title, summary, source_name, source_url, severity")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return data ?? [];
}

async function fetchAllTrumpPosts(): Promise<TrumpPost[]> {
  const { data } = await supabase
    .from("trump_posts")
    .select("id, post_date, posted_at, content, content_ko, source_url, source_name")
    .order("post_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export default async function EventsPage() {
  const [events, trumpPosts] = await Promise.all([
    fetchAllEvents(),
    fetchAllTrumpPosts(),
  ]);

  return (
    <PageShell>
      <EventsPageClient events={events} trumpPosts={trumpPosts} />
    </PageShell>
  );
}
