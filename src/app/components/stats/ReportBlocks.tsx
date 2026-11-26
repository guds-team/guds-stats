// Small presentational blocks shared by the module report pages.

import { useTranslation } from "react-i18next";
import { formatNumber, formatPercent } from "../../lib/format";
import type { FunnelStep } from "../../lib/reports";
import { EmptyState } from "./states";

/** KPI tiles: 2 columns on phones, `cols` on large screens. */
export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>{children}</div>
  );
}

/** Compact facts without a comparison (stock right now): label above value. */
export function StatList({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground" title={item.hint ?? item.label}>
            {item.label}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Shown instead of the formatted value. */
  display?: string;
  /** Second line under the label. */
  note?: string;
}

/** Horizontal bars, largest first as given; the bar length is relative to the largest row. */
export function BarList({
  rows,
  color = "var(--series-1)",
  format = formatNumber,
  empty,
}: {
  rows: BarRow[];
  color?: string;
  format?: (value: number) => string;
  empty?: string;
}) {
  if (!rows.length || rows.every((r) => !r.value)) return <EmptyState hint={null}>{empty}</EmptyState>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="min-w-0 truncate text-muted-foreground" title={row.label}>
            {row.label}
            {row.note && <span className="text-xs"> · {row.note}</span>}
          </span>
          <span className="font-semibold tabular-nums">{row.display ?? format(row.value)}</span>
          <div className="col-span-2 h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(row.value / max) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A conversion funnel: one bar per stage relative to the first measured
 * stage, with the step conversion from the stage before. A stage the backend
 * cannot measure yet (value null) is listed as "not tracked".
 */
export function FunnelBars({ stages, label }: { stages: FunnelStep[]; label: (stage: string) => string }) {
  const { t } = useTranslation();
  const base = stages.find((s) => s.value)?.value ?? 0;
  if (!base) return <EmptyState hint={null} />;
  return (
    <ol className="space-y-3">
      {stages.map((stage, i) => (
        <li key={stage.stage} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              {label(stage.stage)}
            </span>
            <span className="shrink-0 tabular-nums">
              {stage.value === null ? (
                <span className="text-xs text-muted-foreground">{t("reports.notTracked")}</span>
              ) : (
                <>
                  <span className="font-semibold">{formatNumber(stage.value)}</span>
                  {stage.conversion !== null && i > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">{formatPercent(stage.conversion)}</span>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted">
            {stage.value !== null && (
              <div
                className="h-full rounded-full bg-[var(--accent-brand)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, (stage.value / base) * 100)}%` }}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A note listing what the backend does not measure yet, so a missing number is never read as zero. */
export function UnavailableNote({ items }: { items: string[] | undefined }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      {t("reports.unavailable", { items: items.map((k) => t(`reports.unavailableItems.${k}`, { defaultValue: k })).join(", ") })}
    </p>
  );
}

export function Person({ name, phone, id }: { name: string | null; phone?: string | null; id: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{name ?? `#${id}`}</p>
      {phone && (
        <a href={`tel:${phone}`} className="text-xs text-muted-foreground tabular-nums hover:text-foreground">
          {phone}
        </a>
      )}
    </div>
  );
}
