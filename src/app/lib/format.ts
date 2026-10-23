import type { Compared } from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** null / undefined means "not measured", never 0. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? integer.format(value) : decimal.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${decimal.format(value)}%`;
}

/**
 * Whether an increase is good news. A metric whose direction has no clear
 * meaning stays "neutral" and is shown without a good/bad colour.
 */
export type Polarity = "up_is_good" | "up_is_bad" | "neutral";

export type Trend = "up" | "down" | "flat" | "none";

export interface ChangeView {
  trend: Trend;
  tone: "good" | "bad" | "neutral";
  text: string; // "+12,5%", "+4 (oldingi davrda 0)", "O'zgarishsiz", "Taqqoslab bo'lmaydi"
}

export function describeChange(metric: Compared, polarity: Polarity): ChangeView {
  if (metric.comparison === "unavailable" || metric.comparison === "unsupported" || metric.change === null) {
    return { trend: "none", tone: "neutral", text: "Taqqoslab bo'lmaydi" };
  }
  if (metric.comparison === "no_change" || metric.change === 0) {
    return { trend: "flat", tone: "neutral", text: "O'zgarishsiz" };
  }
  const trend: Trend = metric.change > 0 ? "up" : "down";
  const sign = metric.change > 0 ? "+" : "−";
  const tone =
    polarity === "neutral" ? "neutral" : (trend === "up") === (polarity === "up_is_good") ? "good" : "bad";
  if (metric.comparison === "previous_zero" || metric.change_percent === null) {
    // Previous value 0: a percentage would be infinite, show the absolute change.
    return { trend, tone, text: `${sign}${formatNumber(Math.abs(metric.change))} (oldingi davrda 0)` };
  }
  return { trend, tone, text: `${sign}${formatPercent(Math.abs(metric.change_percent))}` };
}
