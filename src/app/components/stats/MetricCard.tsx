import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { describeChange, formatNumber, type Polarity } from "../../lib/format";
import type { Compared } from "../../lib/types";

interface MetricCardProps {
  title: string;
  metric: Compared;
  polarity: Polarity;
  hint?: string;
  compact?: boolean;
}

const TONE_CLASS = {
  good: "text-[color:var(--delta-good)]",
  bad: "text-[color:var(--delta-bad)]",
  neutral: "text-muted-foreground",
};

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight, none: Minus };
const TREND_WORD = { up: "o'sish", down: "kamayish", flat: "", none: "" };

export function MetricCard({ title, metric, polarity, hint, compact }: MetricCardProps) {
  const change = describeChange(metric, polarity);
  const Icon = TREND_ICON[change.trend];
  return (
    <Card className="gap-0">
      <CardContent className={compact ? "space-y-1 px-4 py-4 sm:px-5" : "space-y-2 px-4 py-5 sm:px-6"}>
        <p className="text-sm text-muted-foreground" title={hint}>
          {title}
        </p>
        <p className={compact ? "text-xl font-semibold" : "text-3xl font-semibold tracking-tight"}>
          {formatNumber(metric.value)}
        </p>
        <p className={`flex items-center gap-1 text-xs font-medium ${TONE_CLASS[change.tone]}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {TREND_WORD[change.trend] && <span className="sr-only">{TREND_WORD[change.trend]}: </span>}
            {change.text}
          </span>
        </p>
        {metric.comparison !== "unavailable" && metric.previous !== null && (
          <p className="text-xs text-muted-foreground">Oldingi davr: {formatNumber(metric.previous)}</p>
        )}
      </CardContent>
    </Card>
  );
}
