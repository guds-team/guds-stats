import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/routes";
import { formatDuration } from "../app/lib/format";
// Real responses of the guds backend builders (apps/statistics/reports/), seeded by its tests.
import fixtures from "./fixtures/reports.json";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const BY_PATH: Record<string, unknown> = {
  "/api/stats/finance/": fixtures.finance,
  "/api/stats/daily-works/summary/": fixtures.daily_works,
  "/api/stats/employment/": fixtures.employment,
  "/api/stats/marketplace/": fixtures.marketplace,
};

let calls: { path: string; query: Record<string, string> }[] = [];
let status = 200;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T07:00:00Z"));
  localStorage.setItem("access_token", "token");
  calls = [];
  status = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      const url = new URL(input);
      calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
      if (status !== 200) return Promise.resolve(json({ code: "PERMISSION_DENIED", detail: "Forbidden", errors: [] }, status));
      return Promise.resolve(json({ data: BY_PATH[url.pathname] }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const open = (entry: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [entry] })} />);

describe("module report pages", () => {
  it("finance: requests the period and granularity, shows revenue by module and providers", async () => {
    open("/finance?period=last7&granularity=week");
    await screen.findByRole("heading", { level: 1, name: "Moliya" });
    await screen.findAllByText("Platforma daromadi");
    expect(calls[0]).toEqual({
      path: "/api/stats/finance/",
      query: { date_from: "2026-11-20", date_to: "2026-11-26", granularity: "week" },
    });
    expect(screen.getByText("Modullar bo'yicha daromad")).toBeTruthy();
    expect(screen.getAllByText("Payme").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Eng ko'p sarflaganlar" })).toBeTruthy();
  });

  it("daily jobs: live state, cancellations by side and categories", async () => {
    open("/daily-works");
    await screen.findAllByText("Bajarilish darajasi");
    expect(calls[0].path).toBe("/api/stats/daily-works/summary/");
    expect(screen.getByText("Onlayn ishchilar")).toBeTruthy();
    expect(screen.getAllByText("Buyurtmachi").length).toBeGreaterThan(0);
    expect(screen.getByText("Changed my mind")).toBeTruthy();
    expect(screen.getByText("Cargo")).toBeTruthy();
    // What the backend cannot measure yet is said, not shown as zero.
    expect(screen.getByText(/shikoyatlar, nizolar/)).toBeTruthy();
  });

  it("employment: the hiring funnel stages and the company leaderboard", async () => {
    open("/employment");
    await screen.findByText("Yollash voronkasi");
    for (const stage of ["Vakansiya ko'rildi", "Ariza yuborildi", "Kompaniya ko'rdi", "Suhbat", "Yollandi"]) {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(fixtures.employment.companies[0].name)).toBeTruthy();
  });

  it("marketplace: switching to food keeps the period and asks for market=food", async () => {
    open("/marketplace?period=last30");
    await screen.findAllByText("GMV");
    expect(calls[0].query.market).toBeUndefined();
    expect(screen.getByText("Velosiped 2")).toBeTruthy();
    // Product views are not tracked: the funnel says so instead of showing 0.
    expect(screen.getByText("hozircha kuzatilmaydi")).toBeTruthy();

    screen.getByRole("button", { name: "Taomlar" }).click();
    await waitFor(() => expect(calls.at(-1)?.query.market).toBe("food"));
    expect(calls.at(-1)?.query.date_from).toBe(calls[0].query.date_from);
  });

  it("finance without the finance permission shows the access error", async () => {
    status = 403;
    open("/finance");
    await screen.findByText(/Moliyaviy statistikani ko'rish huquqi yo'q/);
  });
});

describe("formatDuration", () => {
  it("picks the unit by size", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(42, "en")).toBe("42 s");
    expect(formatDuration(600, "en")).toBe("10 min");
    expect(formatDuration(7500, "en")).toBe("2 h 5 min");
    expect(formatDuration(3 * 86400, "en")).toBe("3 days");
  });
});
