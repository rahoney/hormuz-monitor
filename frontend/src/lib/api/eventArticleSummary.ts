import type { EventArticleSummary } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function fetchEventArticleSummary(eventId: number, locale: string): Promise<EventArticleSummary> {
  const normalizedLocale = locale.startsWith("ko") ? "ko" : "en";
  const response = await fetch(`${API_BASE}/events/${eventId}/summary?locale=${normalizedLocale}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`summary request failed: ${response.status}`);
  }
  return response.json();
}
