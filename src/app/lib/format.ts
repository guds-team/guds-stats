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

const oneDecimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

/** 9 450 000 → "9,5 mln" (Uzbek units; Intl's compact notation has none for uz). */
function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${oneDecimal.format(value / 1e9)} mlrd`;
  if (abs >= 1e6) return `${oneDecimal.format(value / 1e6)} mln`;
  return `${oneDecimal.format(value / 1e3)} ming`;
}

/** "1 250 000 so'm"; large amounts in the compact form ("1,3 mln so'm") when `short`. */
export function formatMoney(value: number | null | undefined, currency = "UZS", short = false): string {
  if (value === null || value === undefined) return "—";
  const unit = currency === "UZS" ? "so'm" : currency;
  return `${short && Math.abs(value) >= 100_000 ? compactNumber(value) : integer.format(value)} ${unit}`;
}

/** Time since `iso`: "hozirgina", "12 daq", "3 soat 5 daq", "2 kun". */
export function formatSince(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "hozirgina";
  if (minutes < 60) return `${minutes} daq`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} soat ${minutes % 60} daq` : `${hours} soat`;
  return `${Math.floor(hours / 24)} kun`;
}

/** Wall-clock time in Tashkent: "14:05:09". */
export function formatClock(at: number | string, seconds = true): string {
  return new Date(at).toLocaleTimeString("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
}
