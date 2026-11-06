import i18n, { currentLanguage, LOCALES, type Language } from "./i18n";
import { STATS_TIMEZONE } from "./dates";
import type { Compared } from "./types";

// Number formats per interface language, created once each.
const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(language: Language, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${language}:${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALES[language], options);
    numberFormats.set(key, format);
  }
  return format;
}

const INTEGER = { maximumFractionDigits: 0 };
const DECIMAL = { maximumFractionDigits: 2 };
const ONE_DECIMAL = { maximumFractionDigits: 1 };

const missing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || Number.isNaN(value);

/** null / undefined means "not measured", never 0. */
export function formatNumber(value: number | null | undefined, language: Language = currentLanguage()): string {
  if (missing(value)) return "—";
  return numberFormat(language, Number.isInteger(value) ? INTEGER : DECIMAL).format(value);
}

/** Exactly `digits` decimals ("4,80" / "4.80"), e.g. a rating. */
export function formatFixed(value: number | null | undefined, digits: number, language: Language = currentLanguage()): string {
  if (missing(value)) return "—";
  return numberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** `value` is already a percentage: 12.5 → "12,5%" / "12,5 %" / "12.5%". */
export function formatPercent(value: number | null | undefined, language: Language = currentLanguage()): string {
  if (missing(value)) return "—";
  return numberFormat(language, { style: "percent", ...DECIMAL }).format(value / 100);
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

export function describeChange(metric: Compared, polarity: Polarity, language: Language = currentLanguage()): ChangeView {
  const t = i18n.getFixedT(language);
  if (metric.comparison === "unavailable" || metric.comparison === "unsupported" || metric.change === null) {
    return { trend: "none", tone: "neutral", text: t("change.unavailable") };
  }
  if (metric.comparison === "no_change" || metric.change === 0) {
    return { trend: "flat", tone: "neutral", text: t("change.noChange") };
  }
  const trend: Trend = metric.change > 0 ? "up" : "down";
  const sign = metric.change > 0 ? "+" : "−";
  const tone =
    polarity === "neutral" ? "neutral" : (trend === "up") === (polarity === "up_is_good") ? "good" : "bad";
  if (metric.comparison === "previous_zero" || metric.change_percent === null) {
    // Previous value 0: a percentage would be infinite, show the absolute change.
    const change = `${sign}${formatNumber(Math.abs(metric.change), language)}`;
    return { trend, tone, text: t("change.previousZero", { change }) };
  }
  return { trend, tone, text: `${sign}${formatPercent(Math.abs(metric.change_percent), language)}` };
}

/** 9 450 000 → "9,5 mln" / "9,5 млн" / "9.5M" (Intl's compact notation has no Uzbek units). */
function compactNumber(value: number, language: Language): string {
  const t = i18n.getFixedT(language);
  const abs = Math.abs(value);
  const format = numberFormat(language, ONE_DECIMAL);
  if (abs >= 1e9) return t("units.billion", { value: format.format(value / 1e9) });
  if (abs >= 1e6) return t("units.million", { value: format.format(value / 1e6) });
  return t("units.thousand", { value: format.format(value / 1e3) });
}

/** "1 250 000 so'm"; large amounts in the compact form ("1,3 mln so'm") when `short`. */
export function formatMoney(
  value: number | null | undefined,
  currency = "UZS",
  short = false,
  language: Language = currentLanguage(),
): string {
  if (missing(value)) return "—";
  const unit = currency === "UZS" ? i18n.getFixedT(language)("units.currencyUZS") : currency;
  const amount =
    short && Math.abs(value) >= 100_000 ? compactNumber(value, language) : numberFormat(language, INTEGER).format(value);
  return `${amount} ${unit}`;
}

/** Time since `iso`: "hozirgina", "12 daq", "3 soat 5 daq", "2 kun" (in the interface language). */
export function formatSince(iso: string | null | undefined, now: number, language: Language = currentLanguage()): string {
  if (!iso) return "—";
  const t = i18n.getFixedT(language);
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 ? t("time.hoursMinutes", { hours, minutes: minutes % 60 }) : t("time.hours", { count: hours });
  }
  return t("time.days", { count: Math.floor(hours / 24) });
}

/** "12 daq oldin" / "12 мин назад" / "12 min ago"; "just now" stays as is. */
export function formatAgo(iso: string, now: number, language: Language = currentLanguage()): string {
  const since = formatSince(iso, now, language);
  const justNow = now - new Date(iso).getTime() < 60_000;
  return justNow ? since : i18n.getFixedT(language)("time.ago", { duration: since });
}

/** Wall-clock time in Tashkent: "14:05:09" (12-hour in English). */
export function formatClock(at: number | string, seconds = true, language: Language = currentLanguage()): string {
  return new Date(at).toLocaleTimeString(LOCALES[language], {
    timeZone: STATS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });
}
