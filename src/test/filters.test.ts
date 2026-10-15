import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, todayInStatsTimezone } from "../app/lib/dates";
import {
  DEFAULT_FILTERS,
  parseFilters,
  presetRange,
  serializeFilters,
  toApiParams,
  type Filters,
} from "../app/lib/filters";

const TODAY = "2026-10-15";
const parse = (query: string) => parseFilters(new URLSearchParams(query), TODAY);

describe("presets", () => {
  it.each([
    ["today", ["2026-10-15", "2026-10-15"]],
    ["yesterday", ["2026-10-14", "2026-10-14"]],
    ["last7", ["2026-10-09", "2026-10-15"]],
    ["last30", ["2026-09-16", "2026-10-15"]],
    ["this_month", ["2026-10-01", "2026-10-15"]],
    ["previous_month", ["2026-09-01", "2026-09-30"]],
  ] as const)("%s", (preset, range) => {
    expect(presetRange(preset, TODAY)).toEqual(range);
  });

  it("previous month across a year boundary and in February of a leap year", () => {
    expect(presetRange("previous_month", "2026-01-10")).toEqual(["2025-12-01", "2025-12-31"]);
    expect(presetRange("previous_month", "2028-03-31")).toEqual(["2028-02-01", "2028-02-29"]);
  });
});

describe("today in Tashkent", () => {
  it("uses Asia/Tashkent, not the browser timezone", () => {
    // 19:30 UTC on the 14th is 00:30 on the 15th in Tashkent (UTC+5).
    expect(todayInStatsTimezone(new Date("2026-10-14T19:30:00Z"))).toBe("2026-10-15");
    expect(todayInStatsTimezone(new Date("2026-10-14T18:59:00Z"))).toBe("2026-10-14");
  });
});

describe("URL round trip", () => {
  it("default filters give an empty query string", () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("restores every filter from a shared link", () => {
    const filters: Filters = {
      period: "custom",
      date_from: "2026-09-01",
      date_to: "2026-09-30",
      granularity: "week",
      country: "UZ",
      registered_via: "telegram",
      app: "daily_works",
    };
    const query = serializeFilters(filters).toString();
    expect(query).toBe(
      "period=custom&date_from=2026-09-01&date_to=2026-09-30&granularity=week&country=UZ&registered_via=telegram&app=daily_works",
    );
    expect(parse(query)).toEqual(filters);
  });

  it("keeps presets relative: a shared 'last 7 days' link is the last 7 days when opened", () => {
    expect(toApiParams(parse("period=last7"), "2026-11-01")).toMatchObject({ date_from: "2026-10-26", date_to: "2026-11-01" });
  });

  it("normalises the country code and accepts unknown", () => {
    expect(parse("country=uz").country).toBe("UZ");
    expect(parse("country=Unknown").country).toBe("unknown");
    expect(parse("country=Uzbekistan").country).toBe("");
  });

  it("ignores unknown values instead of failing", () => {
    expect(parse("period=forever&granularity=year&registered_via=fax&app=taxi")).toEqual(DEFAULT_FILTERS);
  });

  it("repairs custom ranges: reversed, in the future, too long, or invalid", () => {
    expect(parse("period=custom&date_from=2026-10-10&date_to=2026-10-01")).toMatchObject({
      date_from: "2026-10-01",
      date_to: "2026-10-10",
    });
    expect(parse("period=custom&date_from=2026-10-10&date_to=2027-01-01")).toMatchObject({ date_to: TODAY });
    expect(parse("period=custom&date_from=2020-01-01&date_to=2026-10-15").date_from).toBe(addDays(TODAY, -730));
    expect(parse("period=custom&date_from=2026-02-30&date_to=2026-03-01").period).toBe("last30");
    expect(parse("period=custom&date_from=2026-10-01").period).toBe("last30");
  });
});

it("resolves the period and passes every filter to the API", () => {
  expect(toApiParams(parse("period=this_month&granularity=month&country=KZ&registered_via=google&app=jobs"), TODAY)).toEqual({
    date_from: "2026-10-01",
    date_to: "2026-10-15",
    granularity: "month",
    country: "KZ",
    registered_via: "google",
    app: "jobs",
  });
});

it("isIsoDate rejects impossible dates", () => {
  expect(isIsoDate("2026-02-28")).toBe(true);
  expect(isIsoDate("2026-02-29")).toBe(false);
  expect(isIsoDate("15.10.2026")).toBe(false);
});
