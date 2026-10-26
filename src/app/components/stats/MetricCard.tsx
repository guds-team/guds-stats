import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
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
}

const TONE_CLASS = {
  good: "bg-[color:var(--delta-good)]/10 text-[color:var(--delta-good)]",
  bad: "bg-[color:var(--delta-bad)]/10 text-[color:var(--delta-bad)]",
  neutral: "bg-muted text-muted-foreground",
};

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight, none: Minus };
const TREND_WORD = { up: "o'sish", down: "kamayish", flat: "", none: "" };

/**
 * A metric of the period against the previous equivalent period. The change
 * comes from the API as is: no comparison is shown when it cannot be computed.
 */
export function MetricCard({ title, metric, polarity, hint, compact, spark }: MetricCardProps) {
  const change = describeChange(metric, polarity);
  const Icon = TREND_ICON[change.trend];
  const shown = useAnimatedNumber(metric.value);
  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-card shadow-card transition-colors hover:border-foreground/15 ${
        compact ? "gap-1 p-4" : "gap-2 p-4 sm:p-5"
      }`}
    >
      <p className="line-clamp-2 text-[13px] text-muted-foreground" title={hint ?? title}>
        {title}
      </p>
      <p
        className={`font-semibold tracking-tight break-all tabular-nums ${compact ? "text-xl" : "text-[28px] leading-9"}`}
        title={formatNumber(metric.value)}
      >
        {formatNumber(shown)}
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
          {TREND_WORD[change.trend] && <span className="sr-only">{TREND_WORD[change.trend]}: </span>}
          {change.text}
        </span>
      </p>
      {metric.comparison !== "unavailable" && metric.previous !== null && (
        <p className="text-xs text-muted-foreground">Oldingi davr: {formatNumber(metric.previous)}</p>
      )}
    </div>
  );
}
