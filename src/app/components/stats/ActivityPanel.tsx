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

const DAILY: { key: Key; label: string; color: string }[] = [
  { key: "dau", label: "DAU", color: seriesColor(0) },
  { key: "wau", label: "WAU (7 kun)", color: seriesColor(1) },
  { key: "mau", label: "MAU (30 kun)", color: seriesColor(2) },
];
const PERIODIC: { key: Key; label: string; color: string }[] = [
  { key: "active_users", label: "Faol foydalanuvchilar", color: seriesColor(0) },
  { key: "dau_average", label: "O'rtacha DAU", color: seriesColor(1) },
];

export function ActivityPanel({ data, params }: { data: Overview; params: ApiParams }) {
  const series = data.series.activity;
  const daily = data.meta.granularity === "day";
  const items = daily ? DAILY : PERIODIC;
  const since = data.summary.activity.tracking_since;
  const empty = series.every((p) => items.every((i) => !p[i.key])); // all 0 or not measured

  const columns: Column<Point>[] = [
    { key: "period", header: "Davr", cell: (p) => bucketTitle(p) },
    ...items.map((i) => ({ key: i.key, header: i.label, numeric: true, cell: (p: Point) => formatNumber(p[i.key]) })),
  ];

  return (
    <Panel
      title="Faol foydalanuvchilar"
      description={
        <>
          {daily
            ? "DAU — shu kuni faol; WAU / MAU — shu kun bilan tugaydigan 7 / 30 kunda faol bo'lgan noyob foydalanuvchilar."
            : "Davr ichida faol bo'lgan noyob foydalanuvchilar (DAU yig'indisi emas) va kunlik o'rtacha DAU."}
          {since && since > data.meta.date_from && (
            <> Faollik {formatDay(since, true)} dan beri kuzatiladi: undan oldingi kunlar bo'sh ("—"), 0 emas.</>
          )}
        </>
      }
      exportTable="activity"
      params={params}
      chart={
        empty ? (
          <EmptyState>{since ? "Tanlangan davrda faollik qayd etilmagan" : "Faollik hali kuzatilmayapti"}</EmptyState>
        ) : (
          // keyed by granularity: legend toggles of the daily lines do not carry over to the weekly ones
          <SeriesLineChart key={data.meta.granularity} data={series} items={items} granularity={data.meta.granularity} />
        )
      }
      table={<DataTable caption="Faol foydalanuvchilar" columns={columns} rows={series} />}
    />
  );
}
