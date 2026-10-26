import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ToggleLegend, axisProps, gridProps, toggle, type SeriesItem } from "../stats/chartParts";
import { EmptyState } from "../stats/states";
import { formatClock, formatNumber } from "../../lib/format";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_ORDER,
  WORKER_STATE_LABELS,
  WORKER_STATE_ORDER,
  jobStatusColor,
  seriesColor,
  workerStateColor,
} from "../../lib/metrics";
import type { LivePoint, LiveSnapshot } from "../../lib/live";

function ChartTooltip({
  active,
  payload,
  items,
  title,
}: {
  active?: boolean;
  payload?: { payload: Record<string, number> }[];
  items: SeriesItem[];
  title: (point: Record<string, number>) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-40 rounded-lg border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur">
      <p className="mb-1.5 font-medium">{title(point)}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden />
              {item.label}
            </span>
            <span className="font-medium tabular-nums">{formatNumber(point[item.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TREND_ITEMS: SeriesItem[] = [
  { key: "workers", label: "Onlayn ishchilar", color: seriesColor(0) },
  { key: "jobs", label: "Faol ishlar", color: seriesColor(1) },
];

/** Online workers and in-flight jobs over the snapshots received since the page opened. */
export function LiveTrendChart({ history }: { history: LivePoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  if (history.length < 2) {
    return (
      <div className="h-[260px]">
        <EmptyState>Trend sahifa ochiq turganda yig'iladi — bir necha soniya kuting</EmptyState>
      </div>
    );
  }
  const visible = TREND_ITEMS.filter((i) => !hidden.has(i.key));
  return (
    <>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              {TREND_ITEMS.map((item) => (
                <linearGradient key={item.key} id={`trend-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="at"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              // Seconds while the trend is short, otherwise every tick would read the same minute.
              tickFormatter={(at: number) => formatClock(at, history[history.length - 1].at - history[0].at < 10 * 60_000)}
              {...axisProps}
              minTickGap={40}
            />
            <YAxis allowDecimals={false} domain={[0, "auto"]} {...axisProps} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={<ChartTooltip items={visible} title={(p) => formatClock(p.at)} />}
            />
            {TREND_ITEMS.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2}
                fill={`url(#trend-${item.key})`}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                hide={hidden.has(item.key)}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ToggleLegend items={TREND_ITEMS} hidden={hidden} onToggle={(k) => setHidden((h) => toggle(h, k))} />
    </>
  );
}

/** One 100% bar split by worker state (2px gaps), with exact counts in the legend below. */
export function WorkerStatesMeter({ counts }: { counts: LiveSnapshot["counts"]["workers"] }) {
  const total = counts.total;
  return (
    <div className="space-y-4">
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={WORKER_STATE_ORDER.map((s) => `${WORKER_STATE_LABELS[s]}: ${counts[s]}`).join(", ")}
      >
        {total > 0 &&
          WORKER_STATE_ORDER.filter((s) => counts[s] > 0).map((state) => (
            <div
              key={state}
              title={`${WORKER_STATE_LABELS[state]}: ${counts[state]}`}
              className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(counts[state] / total) * 100}%`, background: workerStateColor(state) }}
            />
          ))}
      </div>
      <ul className="space-y-2.5">
        {WORKER_STATE_ORDER.map((state) => (
          <li key={state} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: workerStateColor(state) }} aria-hidden />
              {WORKER_STATE_LABELS[state]}
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="font-semibold">{formatNumber(counts[state])}</span>
              <span className="w-10 text-right text-xs text-muted-foreground">
                {total ? `${Math.round((counts[state] / total) * 100)}%` : "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** In-flight jobs per stage, in the order a job moves through them. */
export function JobPipeline({ counts }: { counts: LiveSnapshot["counts"]["jobs"] }) {
  const max = Math.max(1, ...JOB_STATUS_ORDER.map((s) => counts[s]));
  return (
    <ul className="space-y-3">
      {JOB_STATUS_ORDER.map((status) => (
        <li key={status} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: jobStatusColor(status) }} aria-hidden />
              {JOB_STATUS_LABELS[status]}
            </span>
            <span className="font-semibold tabular-nums">{formatNumber(counts[status])}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(counts[status] / max) * 100}%`, background: jobStatusColor(status) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const HOUR_ITEMS: SeriesItem[] = [
  { key: "created", label: "Joylangan", color: seriesColor(0) },
  { key: "completed", label: "Bajarilgan", color: seriesColor(1) },
];

/** Today's jobs per hour (Tashkent time): posted vs completed, side by side. */
export function HourlyJobsChart({ data }: { data: LiveSnapshot["today"]["by_hour"] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = HOUR_ITEMS.filter((i) => !hidden.has(i.key));
  const label = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="hour" tickFormatter={label} {...axisProps} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} domain={[0, "auto"]} {...axisProps} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={<ChartTooltip items={visible} title={(p) => `${label(p.hour)} – ${label((p.hour + 1) % 24)}`} />}
            />
            {HOUR_ITEMS.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={item.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={14}
                hide={hidden.has(item.key)}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ToggleLegend items={HOUR_ITEMS} hidden={hidden} onToggle={(k) => setHidden((h) => toggle(h, k))} />
    </>
  );
}

/** Today's most requested categories; one series, so one colour and no legend. */
export function TopCategories({ rows }: { rows: LiveSnapshot["today"]["by_category"] }) {
  if (!rows.length) return <EmptyState>Bugun hali ish joylanmagan</EmptyState>;
  const max = Math.max(...rows.map((r) => r.jobs));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="truncate text-muted-foreground" title={row.category}>
            {row.category}
          </span>
          <span className="font-semibold tabular-nums">{formatNumber(row.jobs)}</span>
          <div className="col-span-2 h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(row.jobs / max) * 100}%`, background: seriesColor(0) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
