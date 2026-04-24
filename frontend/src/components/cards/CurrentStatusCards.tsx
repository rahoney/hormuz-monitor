"use client";

import { useTranslations } from "next-intl";
import StatusCard from "./StatusCard";
import { statusLevelColor, statusLevelLabel } from "@/lib/formatters";
import type { StraitMetric } from "@/types";

type Props = { metric: StraitMetric | null };

export default function CurrentStatusCards({ metric }: Props) {
  const t = useTranslations("dashboard");

  const status = metric?.status_level ?? "unknown";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatusCard
        label={t("cards.straitStatus")}
        value={statusLevelLabel(status)}
        valueClassName={statusLevelColor(status)}
      />
      <StatusCard
        label={t("cards.vesselCount")}
        value={metric?.total_vessels ?? "—"}
        sub={t("cards.insideStrait")}
      />
      <StatusCard
        label={t("cards.lngVessels")}
        value={metric?.lng_vessels ?? "—"}
      />
      <StatusCard
        label={t("cards.crudeVessels")}
        value={metric?.crude_vessels ?? "—"}
      />
      <StatusCard
        label={t("cards.inlandEntry")}
        value={metric?.inland_entry_count ?? "—"}
        sub={t("cards.persianGulf")}
      />
      <StatusCard
        label={t("cards.offshoreExit")}
        value={metric?.offshore_exit_count ?? "—"}
        sub={t("cards.arabianSea")}
      />
    </div>
  );
}
