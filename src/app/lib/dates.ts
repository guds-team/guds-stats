// Calendar dates as "YYYY-MM-DD" strings in the reporting timezone of the API
// (Asia/Tashkent, docs/STATISTICS_API.md). Arithmetic runs on UTC midnights,
// so the browser's own timezone never shifts a day.

export const STATS_TIMEZONE = "Asia/Tashkent";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInStatsTimezone(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
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

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/** "12 okt" / "12 okt 2025" — short Uzbek label, independent of the browser locale. */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

export function formatMonth(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, !sameYear)} – ${formatDay(to, true)}`;
}
