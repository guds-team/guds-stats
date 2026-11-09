import { act, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/routes";
import { previousRange } from "../app/pages/FinancePage";
import type { JobsReport } from "../app/lib/jobs";
import type { LiveSnapshot } from "../app/lib/live";
import dayFixture from "./fixtures/overview-day.json";
import liveFixture from "./fixtures/live-snapshot.json";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const person = (id: number, name: string, jobs: number, revenue: number) => ({ id, name, phone: null, jobs, revenue });

function report(date_from: string, date_to: string, scale: number): JobsReport {
  return {
    meta: { date_from, date_to, status: "completed", worker: null, client: null, generated_at: "2026-10-15T12:00:00+05:00" },
    totals: { jobs: 4 * scale, revenue: 400_000 * scale, commission: 40_000 * scale, workers: 2, clients: 1 },
    days: [
      { day: date_from, jobs: 1 * scale, revenue: 100_000 * scale, workers: 1, clients: 1 },
      { day: date_to, jobs: 3 * scale, revenue: 300_000 * scale, workers: 2, clients: 1 },
    ],
    workers: [person(7, "Kamol", 3 * scale, 100_000 * scale), person(8, "Sardor", 1 * scale, 300_000 * scale)],
    clients: [person(9, "Malika", 4 * scale, 400_000 * scale)],
    jobs: [
      { job_id: "J1", status: "completed", category: "Cargo", client: null, worker: null, price: 300_000, currency: "UZS",
        workers_count: 1, address: "", at: null, created_at: null, completed_at: null, cancelled_at: null, worker_rating: null },
    ],
    limits: { jobs: 500, people: 200 },
  };
}

let calls: Record<string, string>[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T07:00:00Z")); // 12:00 in Tashkent
  localStorage.setItem("access_token", "token");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      const url = new URL(input);
      if (url.pathname === "/api/stats/overview/") return Promise.resolve(json(dayFixture));
      const q = Object.fromEntries(url.searchParams);
      calls.push(q);
      // The current period is twice the previous one.
      return Promise.resolve(json({ data: report(q.date_from, q.date_to, q.date_to === "2026-10-15" ? 2 : 1) }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("finance page", () => {
  it("takes the equally long period right before as the comparison", () => {
    expect(previousRange("2026-10-09", "2026-10-15")).toEqual(["2026-10-02", "2026-10-08"]);
    expect(previousRange("2026-10-15", "2026-10-15")).toEqual(["2026-10-14", "2026-10-14"]);
  });

  it("shows turnover, commission and earnings against the previous period", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/finance?period=last7"] })} />);
    await screen.findAllByText("Umumiy aylanma");
    expect(calls).toEqual([
      { date_from: "2026-10-09", date_to: "2026-10-15", status: "completed" },
      { date_from: "2026-10-02", date_to: "2026-10-08", status: "completed" },
    ]);
    await waitFor(() => expect(screen.getAllByText("+100%").length).toBeGreaterThan(0));

    const card = (title: string) => screen.getAllByText(title, { selector: "p" })[0].parentElement!.parentElement as HTMLElement;
    expect(within(card("Umumiy aylanma")).getByText("800 ming so'm")).toBeTruthy();
    expect(within(card("Platforma komissiyasi")).getByText(/^80\s000 so'm$/)).toBeTruthy();
    expect(within(card("Ishchilar ishlab topgani")).getByText("720 ming so'm")).toBeTruthy();
    expect(within(card("O'rtacha chek")).getByText("100 ming so'm")).toBeTruthy();

    // Top earners by money, not by number of jobs.
    const top = screen.getByRole("region", { name: "Kim qancha ishlab topdi" });
    const rows = within(top).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Sardor");
    expect(rows[1].textContent).toContain("Kamol");
  });
});

describe("overview page, today live", () => {
  it("shows today's daily works from the live socket above the overview", async () => {
    class Socket {
      static OPEN = 1;
      static last: Socket;
      readyState = 0;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      constructor() {
        Socket.last = this;
      }
      send() {}
      close() {}
    }
    vi.stubGlobal("WebSocket", Socket);
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await waitFor(() => expect(Socket.last).toBeTruthy());
    expect(screen.queryByText("Bugun — jonli")).toBeNull();
    act(() => {
      Socket.last.readyState = 1;
      Socket.last.onopen?.();
      Socket.last.onmessage?.({ data: JSON.stringify({ type: "snapshot", data: liveFixture as LiveSnapshot }) });
    });
    const section = screen.getByRole("region", { name: "Bugun — jonli" });
    expect(within(section).getByText("Bugun bajarilgan")).toBeTruthy();
    expect(within(section).getByText("Dilshod Toshev")).toBeTruthy();
    expect(within(section).getByRole("link", { name: /Jonli kuzatuvga o'tish/ }).getAttribute("href")).toBe("/live");
  });
});
