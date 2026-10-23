import { formatDay, formatMonth, formatRange } from "../../lib/dates";
import { formatNumber } from "../../lib/format";
import type { Bucket } from "../../lib/types";

export const CHART_HEIGHT = 280;

export const axisProps = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

export const gridProps = { stroke: "var(--chart-grid)", strokeDasharray: "0", vertical: false };

export function bucketTick(granularity: string) {
  return (bucket: string) => (granularity === "month" ? formatMonth(bucket) : formatDay(bucket));
}

/** "12 okt" / "6 – 12 okt 2026" / "1 – 15 okt 2026 (to'liq emas)" for a bucket. */
export function bucketTitle(point: Bucket): string {
  const range = formatRange(point.date_from, point.date_to);
  return point.partial ? `${range} (to'liq emas)` : range;
}

export interface SeriesItem {
  key: string;
  label: string;
  color: string;
}

/** Exact values of every visible series for the hovered bucket; null shows as "—" (not measured). */
export function SeriesTooltip({
  active,
  payload,
  items,
  total,
}: {
  active?: boolean;
  payload?: { payload: Bucket & Record<string, unknown> }[];
  items: SeriesItem[];
  total?: (point: Record<string, unknown>) => number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{bucketTitle(point)}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden />
              {item.label}
            </span>
            <span className="font-medium tabular-nums">{formatNumber(point[item.key] as number | null)}</span>
          </li>
        ))}
      </ul>
      {total && (
        <p className="mt-1.5 flex justify-between border-t pt-1.5 font-medium">
          <span>Jami</span>
          <span className="tabular-nums">{formatNumber(total(point))}</span>
        </p>
      )}
    </div>
  );
}

/** Clickable legend: each entry toggles its series (keyboard: Tab + Enter/Space). */
export function ToggleLegend({
  items,
  hidden,
  onToggle,
}: {
  items: SeriesItem[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Seriyalar">
      {items.map((item) => {
        const off = hidden.has(item.key);
        return (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={!off}
              onClick={() => onToggle(item.key)}
              className={`flex items-center gap-1.5 rounded text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                off ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: off ? "transparent" : item.color, border: `2px solid ${item.color}` }}
                aria-hidden
              />
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
