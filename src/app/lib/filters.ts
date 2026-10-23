// Dashboard filters <-> URL query string <-> API parameters.
//
// The URL is the single source of truth: shared links and browser
// back/forward restore the same view. Presets are stored by name
// (?period=last7), so a shared "last 7 days" link stays relative to the day it
// is opened; a custom range is stored as dates (?period=custom&date_from=…).

import { addDays, daysBetween, endOfPreviousMonth, isIsoDate, startOfMonth } from "./dates";

export const PRESETS = ["today", "yesterday", "last7", "last30", "this_month", "previous_month", "custom"] as const;
export type Preset = (typeof PRESETS)[number];

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const REGISTRATION_METHODS = ["phone", "email", "google", "apple", "telegram", "whatsapp", "unknown"] as const;
export const APPS = ["jobs", "daily_works", "messaging", "wallet"] as const;

/** Same limit as the API (OverviewQuerySerializer.MAX_DAYS). */
export const MAX_RANGE_DAYS = 731;

export interface Filters {
  period: Preset;
  date_from: string; // only meaningful for "custom"
  date_to: string;
  granularity: Granularity;
  country: string; // "" = all; ISO alpha-2 upper case or "unknown"
  registered_via: string;
  app: string;
}

export const DEFAULT_FILTERS: Filters = {
  period: "last30",
  date_from: "",
  date_to: "",
  granularity: "day",
  country: "",
  registered_via: "",
  app: "",
};

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Parse the URL; anything unknown or malformed falls back to its default instead of failing the page. */
export function parseFilters(params: URLSearchParams, today: string): Filters {
  const filters: Filters = {
    ...DEFAULT_FILTERS,
    period: oneOf(PRESETS, params.get("period"), DEFAULT_FILTERS.period),
    granularity: oneOf(GRANULARITIES, params.get("granularity"), DEFAULT_FILTERS.granularity),
    registered_via: oneOf(REGISTRATION_METHODS, params.get("registered_via"), ""),
    app: oneOf(APPS, params.get("app"), ""),
  };
  const country = (params.get("country") ?? "").trim();
  if (country.toLowerCase() === "unknown") filters.country = "unknown";
  else if (/^[a-z]{2}$/i.test(country)) filters.country = country.toUpperCase();

  if (filters.period === "custom") {
    let from = params.get("date_from");
    let to = params.get("date_to");
    if (!isIsoDate(from) || !isIsoDate(to)) return { ...filters, period: DEFAULT_FILTERS.period };
    if (from > to) [from, to] = [to, from]; // a reversed shared range still means that range
    if (to > today) to = today;
    if (from > to) from = to;
    if (daysBetween(from, to) >= MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
    filters.date_from = from;
    filters.date_to = to;
  }
  return filters;
}

/** Only non-default values, in a stable order, so equal filters give equal URLs. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.period !== DEFAULT_FILTERS.period) params.set("period", filters.period);
  if (filters.period === "custom") {
    params.set("date_from", filters.date_from);
    params.set("date_to", filters.date_to);
  }
  if (filters.granularity !== DEFAULT_FILTERS.granularity) params.set("granularity", filters.granularity);
  if (filters.country) params.set("country", filters.country);
  if (filters.registered_via) params.set("registered_via", filters.registered_via);
  if (filters.app) params.set("app", filters.app);
  return params;
}

export function presetRange(period: Preset, today: string, custom?: { from: string; to: string }): [string, string] {
  switch (period) {
    case "today":
      return [today, today];
    case "yesterday":
      return [addDays(today, -1), addDays(today, -1)];
    case "last7":
      return [addDays(today, -6), today];
    case "last30":
      return [addDays(today, -29), today];
    case "this_month":
      return [startOfMonth(today), today];
    case "previous_month": {
      const end = endOfPreviousMonth(today);
      return [startOfMonth(end), end];
    }
    case "custom":
      return [custom?.from || today, custom?.to || today];
  }
}

export type ApiParams = Record<"date_from" | "date_to" | "granularity" | "country" | "registered_via" | "app", string>;

export function toApiParams(filters: Filters, today: string): ApiParams {
  const [date_from, date_to] = presetRange(filters.period, today, { from: filters.date_from, to: filters.date_to });
  return {
    date_from,
    date_to,
    granularity: filters.granularity,
    country: filters.country,
    registered_via: filters.registered_via,
    app: filters.app,
  };
}

export function hasDimensionFilters(filters: Filters): boolean {
  return Boolean(filters.country || filters.registered_via || filters.app);
}
