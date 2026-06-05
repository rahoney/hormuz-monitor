import type { EventArticleSummary } from "@/types";

export async function fetchEventArticleSummary(eventId: number, locale: string): Promise<EventArticleSummary> {
  const normalizedLocale = locale.startsWith("ko") ? "ko" : "en";
  const response = await fetch(`/api/events/${eventId}/summary?locale=${normalizedLocale}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`summary request failed: ${response.status}`);
  }
  return response.json();
}
