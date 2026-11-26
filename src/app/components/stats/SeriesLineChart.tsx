import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_HEIGHT, SeriesTooltip, ToggleLegend, axisProps, bucketTick, gridProps, toggle, type SeriesItem } from "./chartParts";
import type { Bucket } from "../../lib/types";

/**
 * Lines over the dashboard buckets: crosshair tooltip with exact values,
 * a legend that toggles series, gaps (not zeros) where a value is null.
 */
export function SeriesLineChart<Point extends Bucket>({
  data,
  items,
  granularity,
  format,
  axisFormat,
}: {
  data: Point[];
  items: SeriesItem[];
  granularity: string;
  /** Tooltip value format (numbers by default). */
  format?: (value: number | null) => string;
  /** Y axis tick format, e.g. compact money. */
  axisFormat?: (value: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  return (
    <>
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: axisFormat ? 0 : -16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="bucket" tickFormatter={bucketTick(granularity)} {...axisProps} minTickGap={16} />
            <YAxis allowDecimals={false} tickFormatter={axisFormat} width={axisFormat ? 56 : undefined} {...axisProps} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={<SeriesTooltip items={items.filter((i) => !hidden.has(i.key))} format={format} />}
            />
            {items.map((item) => (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2}
                dot={data.length <= 2 ? { r: 4 } : false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                connectNulls={false}
                hide={hidden.has(item.key)}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ToggleLegend items={items} hidden={hidden} onToggle={(k) => setHidden((h) => toggle(h, k))} />
    </>
  );
}
