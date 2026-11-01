import { useTranslation } from "react-i18next";
import { DataTable, type Column } from "./DataTable";
import { Panel } from "./Panel";
import { SeriesLineChart } from "./SeriesLineChart";
import { EmptyState } from "./states";
import { bucketTitle } from "./chartParts";
import { formatDay } from "../../lib/dates";
import type { ApiParams } from "../../lib/filters";
import { formatNumber } from "../../lib/format";
import { seriesColor } from "../../lib/metrics";
import type { Overview } from "../../lib/types";

type Point = Overview["series"]["activity"][number];
type Key = "dau" | "wau" | "mau" | "active_users" | "dau_average";

const DAILY: Key[] = ["dau", "wau", "mau"];
const PERIODIC: Key[] = ["active_users", "dau_average"];

export function ActivityPanel({ data, params }: { data: Overview; params: ApiParams }) {
  const { t } = useTranslation();
  const series = data.series.activity;
  const daily = data.meta.granularity === "day";
  const items = (daily ? DAILY : PERIODIC).map((key, i) => ({
    key,
    label: t(`panels.activity.series.${key}`),
    color: seriesColor(i),
  }));
  const since = data.summary.activity.tracking_since;
  const empty = series.every((p) => items.every((i) => !p[i.key])); // all 0 or not measured

  const columns: Column<Point>[] = [
    { key: "period", header: t("tables.period"), cell: (p) => bucketTitle(p), sort: (p) => p.bucket },
    ...items.map((i) => ({
      key: i.key,
      header: i.label,
      numeric: true,
      cell: (p: Point) => formatNumber(p[i.key]),
      sort: (p: Point) => p[i.key],
    })),
  ];

  return (
    <Panel
      title={t("panels.activity.title")}
      description={
        <>
          {daily ? t("panels.activity.descriptionDaily") : t("panels.activity.descriptionPeriodic")}
          {since && since > data.meta.date_from && <> {t("panels.activity.trackingSince", { date: formatDay(since, true) })}</>}
        </>
      }
      exportTable="activity"
      params={params}
      chart={
        empty ? (
          <EmptyState>{since ? t("panels.activity.emptyInPeriod") : t("panels.activity.notTracked")}</EmptyState>
        ) : (
          // keyed by granularity: legend toggles of the daily lines do not carry over to the weekly ones
          <SeriesLineChart key={data.meta.granularity} data={series} items={items} granularity={data.meta.granularity} />
        )
      }
      table={<DataTable caption={t("panels.activity.title")} columns={columns} rows={series} />}
    />
  );
}
