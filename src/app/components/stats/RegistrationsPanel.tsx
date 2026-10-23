import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "./DataTable";
import { Panel } from "./Panel";
import { EmptyState } from "./states";
import {
  CHART_HEIGHT,
  SeriesTooltip,
  ToggleLegend,
  axisProps,
  bucketTick,
  bucketTitle,
  gridProps,
  toggle,
} from "./chartParts";
import type { ApiParams } from "../../lib/filters";
import { formatNumber } from "../../lib/format";
import { METHOD_LABELS, METHOD_ORDER, methodColor } from "../../lib/metrics";
import type { Overview } from "../../lib/types";

type Point = Overview["series"]["registrations"][number];

export function RegistrationsPanel({ data, params }: { data: Overview; params: ApiParams }) {
  const series = data.series.registrations;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Stacked in the fixed method order (neighbouring colours are the validated pairs), unknown last.
  const methods = useMemo(() => {
    const present = Object.keys(series[0]?.by_registered_via ?? {});
    const rank = (m: string) => (METHOD_ORDER.includes(m) ? METHOD_ORDER.indexOf(m) : METHOD_ORDER.length);
    return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [series]);
  const items = methods.map((m) => ({ key: m, label: METHOD_LABELS[m] ?? m, color: methodColor(m) }));
  const visible = items.filter((i) => !hidden.has(i.key));
  const top = visible[visible.length - 1]?.key; // the segment that gets the rounded top
  const rows = useMemo(() => series.map((p) => ({ ...p, ...p.by_registered_via })), [series]);
  const empty = series.every((p) => p.registrations === 0);

  const columns: Column<Point>[] = [
    { key: "period", header: "Davr", cell: (p) => bucketTitle(p) },
    { key: "total", header: "Jami", numeric: true, cell: (p) => formatNumber(p.registrations) },
    ...methods.map((m) => ({
      key: m,
      header: METHOD_LABELS[m] ?? m,
      numeric: true,
      cell: (p: Point) => formatNumber(p.by_registered_via[m]),
    })),
  ];

  const chart = empty ? (
    <EmptyState />
  ) : (
    <>
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="bucket" tickFormatter={bucketTick(data.meta.granularity)} {...axisProps} minTickGap={16} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={<SeriesTooltip items={visible} total={(p) => p.registrations as number} />}
            />
            {items.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="registrations"
                fill={item.color}
                stroke="var(--card)"
                strokeWidth={1}
                hide={hidden.has(item.key)}
                radius={item.key === top ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ToggleLegend items={items} hidden={hidden} onToggle={(k) => setHidden((h) => toggle(h, k))} />
    </>
  );

  return (
    <Panel
      title="Ro'yxatdan o'tishlar"
      description="Yangi akkauntlar, ro'yxatdan o'tish usuli bo'yicha"
      exportTable="registrations"
      params={params}
      chart={chart}
      table={<DataTable caption="Ro'yxatdan o'tishlar" columns={columns} rows={series} />}
    />
  );
}
