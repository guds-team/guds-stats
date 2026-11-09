import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sparkline, useAnimatedNumber } from "../layout/Page";
import { describeChange, formatNumber, type Polarity } from "../../lib/format";
import type { Compared } from "../../lib/types";

interface MetricCardProps {
  title: string;
  metric: Compared;
  polarity: Polarity;
  hint?: string;
  compact?: boolean;
  /** The metric per bucket of the period, drawn as a small trend line. */
  spark?: (number | null)[];
  /** What the value covers when it is not the whole period ("Today", "This week"). */
  scope?: string;
  /** Replaces "Previous period: …" (e.g. "Previous day: …"). */
  previousText?: string;
  /** One more line under the comparison, e.g. the whole period's total. */
  footnote?: string;
  /** Value format, e.g. money; numbers by default. */
  format?: (value: number | null) => string;
}

const TONE_CLASS = {
  good: "bg-[color:var(--delta-good)]/10 text-[color:var(--delta-good)]",
  bad: "bg-[color:var(--delta-bad)]/10 text-[color:var(--delta-bad)]",
  neutral: "bg-muted text-muted-foreground",
};

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight, none: Minus };

/**
 * A metric of the period against the previous equivalent period. The change
 * comes from the API as is: no comparison is shown when it cannot be computed.
 */
export function MetricCard({
  title,
  metric,
  polarity,
  hint,
  compact,
  spark,
  scope,
  previousText,
  footnote,
  format = formatNumber,
}: MetricCardProps) {
  const { t } = useTranslation();
  const change = describeChange(metric, polarity);
  const trendWord = change.trend === "up" ? t("change.up") : change.trend === "down" ? t("change.down") : "";
  const Icon = TREND_ICON[change.trend];
  const shown = useAnimatedNumber(metric.value);
  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-card shadow-card transition-colors hover:border-foreground/15 ${
        compact ? "gap-1 p-4" : "gap-2 p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] text-muted-foreground" title={hint ?? title}>
          {title}
        </p>
        {scope && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
            {scope}
          </span>
        )}
      </div>
      <p
        className={`font-semibold tracking-tight break-all tabular-nums ${compact ? "text-xl" : "text-[28px] leading-9"}`}
        title={format(metric.value)}
      >
        {format(shown)}
      </p>
      {spark && !compact && (
        <div className="hidden sm:block">
          <Sparkline values={spark} />
        </div>
      )}
      <p
        className={`mt-auto inline-flex max-w-full items-start gap-1 self-start rounded-md px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[change.tone]}`}
      >
        <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {trendWord && <span className="sr-only">{trendWord}: </span>}
          {change.text}
        </span>
      </p>
      {metric.comparison !== "unavailable" && metric.previous !== null && (
        <p className="text-xs text-muted-foreground">
          {previousText ?? t("change.previousPeriod", { value: format(metric.previous) })}
        </p>
      )}
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}
