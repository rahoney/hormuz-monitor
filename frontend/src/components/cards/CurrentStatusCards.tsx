"use client";

import { useTranslations } from "next-intl";
import StatusCard from "./StatusCard";
import { statusLevelColor } from "@/lib/formatters";
import type { WeeklyTransitSummary } from "@/types";

type Props = { summary: WeeklyTransitSummary | null };

export default function CurrentStatusCards({ summary }: Props) {
  const t = useTranslations("dashboard");

  const status = summary?.status_level ?? "unknown";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <StatusCard
        label={t("cards.straitStatus")}
        value={t(`status.${status}`)}
        valueClassName={statusLevelColor(status)}
        sub={summary?.source === "aisstream_estimate" ? t("cards.estimated") : t("cards.confirmed")}
      />
      <StatusCard
        label={t("cards.vesselCount")}
        value={summary?.total_vessels ?? "—"}
        sub={t("cards.weeklyAverage")}
      />
      <StatusCard
        label={t("cards.tankerVessels")}
        value={summary?.tanker_vessels ?? "—"}
        sub={t("cards.weeklyAverage")}
      />
      <StatusCard
        label={t("cards.containerVessels")}
        value={summary?.container_vessels ?? "—"}
        sub={t("cards.weeklyAverage")}
      />
      <StatusCard
        label={t("cards.dryBulkVessels")}
        value={summary?.dry_bulk_vessels ?? "—"}
        sub={t("cards.weeklyAverage")}
      />
      <StatusCard
        label={t("cards.generalCargoVessels")}
        value={summary?.general_cargo_vessels ?? "—"}
        sub={t("cards.weeklyAverage")}
      />
      <StatusCard
        label={t("cards.inlandEntry")}
        value={summary?.inland_entry_count ?? "—"}
        sub={t("cards.aisEstimated")}
      />
      <StatusCard
        label={t("cards.offshoreExit")}
        value={summary?.offshore_exit_count ?? "—"}
        sub={t("cards.aisEstimated")}
      />
    </div>
  );
}
