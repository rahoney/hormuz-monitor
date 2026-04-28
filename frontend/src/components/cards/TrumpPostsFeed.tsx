"use client";

import { useTranslations, useLocale } from "next-intl";
import type { TrumpPost } from "@/types";

type Props = { posts: TrumpPost[]; fullPage?: boolean };

export default function TrumpPostsFeed({ posts, fullPage = false }: Props) {
  const t = useTranslations("dashboard.trump");
  const locale = useLocale();

  if (posts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        {t("noData")}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 pr-1 ${fullPage ? "" : "max-h-[390px] overflow-y-auto"}`}
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#1e40af #0f172a",
      }}
    >
      {posts.map((post) => (
        <div
          key={post.id}
          className="min-w-0 rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 flex flex-col gap-2 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/[0.10]"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-bold text-red-400">@realDonaldTrump</span>
              <span className="truncate text-xs text-slate-500">{post.source_name}</span>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{post.post_date}</span>
          </div>
          <p className="min-w-0 text-sm text-slate-200 leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {locale === "ko" && post.content_ko ? post.content_ko : post.content}
          </p>
          {post.source_url && (
            <a
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors w-fit"
            >
              {t("viewOriginal")} →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
