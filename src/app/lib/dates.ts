// Calendar dates as "YYYY-MM-DD" strings in the reporting timezone of the API
// (Asia/Tashkent, docs/STATISTICS_API.md). Arithmetic runs on UTC midnights,
// so the browser's own timezone never shifts a day.

import { currentLanguage, LOCALES, type Language } from "./i18n";

export const STATS_TIMEZONE = "Asia/Tashkent";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInStatsTimezone(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD: the API's date format, not a display locale.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STATS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  return fromUtc(toUtc(value)) === value; // rejects 2026-02-30
}

export function addDays(day: string, days: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function endOfPreviousMonth(day: string): string {
  return addDays(startOfMonth(day), -1);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

// Display labels. A day is formatted at its UTC midnight in UTC, so it is the
// same calendar day whatever the browser's timezone.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${language}:${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALES[language], options);
    formatters.set(key, format);
  }
  return format;
}

/** "12-okt" / "12 окт." / "Oct 12", with the year when asked. */
export function formatDay(day: string, withYear = false, language: Language = currentLanguage()): string {
  return formatter(language, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(toUtc(day));
}

export function formatMonth(day: string, language: Language = currentLanguage()): string {
  return formatter(language, { month: "short", year: "numeric", timeZone: "UTC" }).format(toUtc(day));
}

export function formatRange(from: string, to: string, language: Language = currentLanguage()): string {
  if (from === to) return formatDay(from, true, language);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, !sameYear, language)} – ${formatDay(to, true, language)}`;
}

/** A moment (ISO timestamp) as short date and time in `timeZone`. */
export function formatDateTime(iso: string, timeZone: string = STATS_TIMEZONE, language: Language = currentLanguage()): string {
  return formatter(language, { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
