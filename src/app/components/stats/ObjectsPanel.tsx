import { useMemo, useState } from "react";
import { DataTable, type Column } from "./DataTable";
import { Panel } from "./Panel";
import { SeriesLineChart } from "./SeriesLineChart";
import { EmptyState } from "./states";
import { bucketTitle } from "./chartParts";
import type { ApiParams } from "../../lib/filters";
import { formatNumber } from "../../lib/format";
import { APP_LABELS, objectLabel, seriesColor } from "../../lib/metrics";
import type { Overview } from "../../lib/types";

type Point = Overview["series"]["objects"][number];

/**
 * One application at a time (at most four series, so every line keeps a
 * distinguishable colour); the global ?app= filter narrows the choice. The
 * table and the CSV hold every metric of the filtered apps.
 */
export function ObjectsPanel({ data, params }: { data: Overview; params: ApiParams }) {
  const metrics = data.summary.objects;
  const apps = useMemo(() => [...new Set(Object.values(metrics).map((m) => m.app))], [metrics]);
  const [chosen, setChosen] = useState("");
  const app = apps.includes(chosen) ? chosen : apps[0];
  const series = data.series.objects;

  const keys = Object.keys(metrics).filter((k) => metrics[k].app === app);
  const items = keys.map((k, i) => ({ key: k, label: objectLabel(k, metrics[k].label), color: seriesColor(i) }));
  const empty = series.every((p) => keys.every((k) => !p[k]));

  const columns: Column<Point>[] = [
    { key: "period", header: "Davr", cell: (p) => bucketTitle(p) },
    ...Object.keys(metrics).map((k) => ({
      key: k,
      header: objectLabel(k, metrics[k].label),
      numeric: true,
      cell: (p: Point) => formatNumber(p[k] as number),
    })),
  ];

  const appSelect =
    apps.length > 1 ? (
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Grafikdagi ilova</span>
        <select
          value={app}
          onChange={(e) => setChosen(e.target.value)}
          className="h-8 rounded-md border bg-input-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          {apps.map((a) => (
            <option key={a} value={a}>
              {APP_LABELS[a] ?? a}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <Panel
      title="Obyektlar dinamikasi"
      description="Har bir obyekt o'z vaqt belgisi bo'yicha (yaratilgan, bajarilgan, to'langan …) hisoblanadi"
      exportTable="objects"
      params={params}
      toolbar={appSelect}
      chart={
        !app ? (
          <EmptyState />
        ) : empty ? (
          <EmptyState>{APP_LABELS[app] ?? app}: tanlangan davrda yangi obyektlar yo'q</EmptyState>
        ) : (
          <SeriesLineChart key={app} data={series} items={items} granularity={data.meta.granularity} />
        )
      }
      table={<DataTable caption="Obyektlar dinamikasi" columns={columns} rows={series} />}
    />
  );
}
