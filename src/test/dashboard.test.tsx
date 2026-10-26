import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/routes";
import { API_BASE } from "../app/lib/api";
import { clearOverviewCache } from "../app/lib/useOverview";
import type { Overview } from "../app/lib/types";
// Real responses of the guds backend (GET /api/stats/overview/ on its test dataset).
import dayFixture from "./fixtures/overview-day.json";
import weekFixture from "./fixtures/overview-week.json";

type Handler = (url: URL) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

let fetchMock: ReturnType<typeof vi.fn>;

function serve(handler: Handler) {
  fetchMock = vi.fn((input: string) => Promise.resolve(handler(new URL(input))));
  vi.stubGlobal("fetch", fetchMock);
}

/** Overview requests made so far, as their query parameters. */
function overviewCalls(): Record<string, string>[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(input as string))
    .filter((url) => url.pathname === "/api/stats/overview/")
    .map((url) => Object.fromEntries(url.searchParams));
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const byGranularity: Handler = (url) => json(url.searchParams.get("granularity") === "week" ? weekFixture : dayFixture);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T07:00:00Z")); // 12:00 in Tashkent
  localStorage.setItem("access_token", "token");
  clearOverviewCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("filters and the URL", () => {
  it("restores every filter from a shared link and requests exactly that", async () => {
    serve(byGranularity);
    const router = renderAt(
      "/?period=custom&date_from=2026-10-02&date_to=2026-10-15&granularity=week&country=uz&registered_via=phone&app=jobs",
    );
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(overviewCalls()).toEqual([
      {
        date_from: "2026-10-02",
        date_to: "2026-10-15",
        granularity: "week",
        country: "UZ",
        registered_via: "phone",
        app: "jobs",
      },
    ]);
    expect((screen.getByLabelText("Davr") as HTMLSelectElement).value).toBe("custom");
    expect((screen.getByLabelText("Boshlanish sanasi") as HTMLInputElement).value).toBe("2026-10-02");
    expect((screen.getByLabelText("Davlat") as HTMLSelectElement).value).toBe("UZ");
    expect((screen.getByLabelText("Ro'yxatdan o'tish usuli") as HTMLSelectElement).value).toBe("phone");
    expect((screen.getByLabelText("Ilova") as HTMLSelectElement).value).toBe("jobs");
    expect(screen.getByRole("button", { name: "Hafta" }).getAttribute("aria-pressed")).toBe("true");
    expect(router.state.location.search).toContain("country=UZ"); // rewritten to the canonical link
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer token" });
  });

  it("updates the URL on every filter change and feeds every section from one request", async () => {
    serve(byGranularity);
    const router = renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(overviewCalls()[0]).toMatchObject({ date_from: "2026-09-16", date_to: "2026-10-15", granularity: "day" });

    fireEvent.change(screen.getByLabelText("Davr"), { target: { value: "last7" } });
    await waitFor(() => expect(overviewCalls()).toHaveLength(2));
    expect(router.state.location.search).toBe("?period=last7");
    expect(overviewCalls()[1]).toMatchObject({ date_from: "2026-10-09", date_to: "2026-10-15" });

    fireEvent.change(screen.getByLabelText("Davlat"), { target: { value: "KZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Hafta" }));
    await waitFor(() => expect(overviewCalls()).toHaveLength(4));
    expect(router.state.location.search).toBe("?period=last7&granularity=week&country=KZ");
    expect(overviewCalls()[3]).toEqual({ date_from: "2026-10-09", date_to: "2026-10-15", granularity: "week", country: "KZ" });
    await screen.findByRole("region", { name: "Ro'yxatdan o'tishlar" });
    expect(fetchMock).toHaveBeenCalledTimes(4); // no section fetches on its own
  });

  it("switches to a custom range starting from the dates on screen", async () => {
    serve(byGranularity);
    const router = renderAt("/?period=last7");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.change(screen.getByLabelText("Davr"), { target: { value: "custom" } });
    await waitFor(() =>
      expect(router.state.location.search).toBe("?period=custom&date_from=2026-10-09&date_to=2026-10-15"),
    );
    fireEvent.change(screen.getByLabelText("Tugash sanasi"), { target: { value: "2026-10-01" } });
    // moving the end before the start drags the start along
    await waitFor(() => expect(router.state.location.search).toBe("?period=custom&date_from=2026-10-01&date_to=2026-10-01"));
  });

  it("supports back / forward without repeating a request", async () => {
    serve(byGranularity);
    const router = renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: "Oy" }));
    await waitFor(() => expect(overviewCalls()).toHaveLength(2));

    await act(() => router.navigate(-1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Kun" }).getAttribute("aria-pressed")).toBe("true"));
    await act(() => router.navigate(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Oy" }).getAttribute("aria-pressed")).toBe("true"));
    expect(overviewCalls()).toHaveLength(2); // both views came from the cache
  });

  it("does not request again when the same filter is chosen twice", async () => {
    serve(byGranularity);
    renderAt("/?granularity=week");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: "Hafta" }));
    fireEvent.click(screen.getByRole("button", { name: "Hafta" }));
    expect(overviewCalls()).toHaveLength(1);
  });

  it("resets every filter", async () => {
    serve(byGranularity);
    const router = renderAt("/?period=last7&country=UZ&app=jobs");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: /Tozalash/ }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect((screen.getByRole("button", { name: /Tozalash/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("brings a logged-out visitor back to the shared filters after login", async () => {
    localStorage.clear();
    serve(byGranularity);
    const router = renderAt("/?period=last7&country=UZ");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(new URLSearchParams(router.state.location.search).get("next")).toBe("/?period=last7&country=UZ");
  });
});

describe("states", () => {
  it("shows skeletons while loading, then the data", async () => {
    let release!: () => void;
    serve(() => new Promise<Response>((resolve) => (release = () => resolve(json(dayFixture)))));
    renderAt("/");
    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
    await act(async () => release());
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
  });

  it("shows an actionable error and recovers on retry", async () => {
    let fail = true;
    serve(() => (fail ? json({ code: "SERVER_ERROR", detail: "boom" }, 500) : json(dayFixture)));
    renderAt("/");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Serverda xatolik");
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: /Qayta urinish/ }));
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not keep the previous filters' numbers on screen after an error", async () => {
    serve((url) => (url.searchParams.get("granularity") === "week" ? json({ code: "SERVER_ERROR" }, 500) : json(dayFixture)));
    renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: "Hafta" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Yangi ro'yxatdan o'tishlar")).toBeNull();
  });

  it("shows the API's validation message", async () => {
    serve(() =>
      json({ code: "VALIDATION_FAILED", detail: "Invalid", errors: [{ field: "date_to", message: "The period is limited to 731 days." }] }, 400),
    );
    renderAt("/");
    expect((await screen.findByRole("alert")).textContent).toContain("The period is limited to 731 days.");
  });

  it("explains a missing permission", async () => {
    serve(() => json({ code: "PERMISSION_DENIED", detail: "No" }, 403));
    renderAt("/");
    expect((await screen.findByRole("alert")).textContent).toContain("huquqi yo'q");
  });

  it("sends an expired session to the login page, keeping the filters", async () => {
    serve(() => json({ code: "NOT_AUTHENTICATED", detail: "expired" }, 401));
    const router = renderAt("/?period=last7");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(new URLSearchParams(router.state.location.search).get("next")).toBe("/?period=last7");
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("forgets cached responses on logout (they carry viewer-specific links)", async () => {
    serve(byGranularity);
    const router = renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: /Chiqish/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    localStorage.setItem("access_token", "other-user");
    await act(() => router.navigate("/"));
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(overviewCalls()).toHaveLength(2); // the next user's request goes to the API
  });

  it("shows empty states when nothing matches the filters", async () => {
    const empty = clone(dayFixture) as unknown as { data: Overview };
    const d = empty.data;
    for (const p of d.series.registrations) {
      p.registrations = 0;
      for (const k of Object.keys(p.by_registered_via)) p.by_registered_via[k] = 0;
    }
    for (const p of d.series.activity) Object.assign(p, { dau: null, wau: null, mau: null });
    d.summary.activity.tracking_since = null;
    for (const s of d.summary.authentication.stages) s.value = 0;
    d.breakdowns.country = [];
    d.breakdowns.registered_via = [];
    serve(() => json(empty));
    renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    expect(screen.getAllByText("Tanlangan filtrlar bo'yicha ma'lumot yo'q").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Faollik hali kuzatilmayapti")).toBeTruthy();
  });
});

describe("sections with real API data", () => {
  it("renders summary cards with previous-period comparison", async () => {
    serve(byGranularity);
    renderAt("/");
    const card = (await screen.findByText("Yangi ro'yxatdan o'tishlar")).parentElement!;
    const registrations = dayFixture.data.summary.users.new_registrations;
    expect(card.textContent).toContain(String(registrations.value));
    expect(card.textContent).toContain(`+${registrations.change} (oldingi davrda 0)`); // never a percentage of 0
    expect(screen.getByText("WAU").parentElement!.textContent).toContain("Taqqoslab bo'lmaydi");
  });

  it("lists only created objects in the created-objects cards", async () => {
    serve(byGranularity);
    renderAt("/");
    const box = (await screen.findByRole("heading", { name: "Yaratilgan obyektlar" })).parentElement!;
    const created = Object.values(dayFixture.data.summary.objects).filter((m) => m.kind === "created");
    expect(within(box).getAllByText(/Oldingi davr/)).toHaveLength(created.length);
    expect(within(box).queryByText("Bekor qilingan to'lovlar")).toBeNull();
    expect(within(box).getByText("Vakansiyalar")).toBeTruthy();
  });

  it("draws registrations stacked by method, with legend toggles and a table view", async () => {
    serve(byGranularity);
    renderAt("/");
    const panel = await screen.findByRole("region", { name: "Ro'yxatdan o'tishlar" });
    expect(panel.querySelectorAll(".recharts-bar").length).toBe(4); // phone, google, telegram, unknown
    const phone = within(panel).getByRole("button", { name: "Telefon (SMS)" });
    expect(phone.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(phone);
    expect(phone.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(within(panel).getByRole("button", { name: /Jadval/ }));
    expect(within(panel).getAllByRole("row")).toHaveLength(1 + dayFixture.data.series.registrations.length);
    expect(within(panel).getByRole("columnheader", { name: "Telefon (SMS)" })).toBeTruthy();
  });

  it("draws DAU / WAU / MAU by day and distinct active users by week", async () => {
    serve(byGranularity);
    renderAt("/");
    const activity = () => screen.getByRole("region", { name: "Faol foydalanuvchilar" });
    await screen.findByRole("region", { name: "Faol foydalanuvchilar" });
    expect(within(activity()).getByRole("button", { name: "MAU (30 kun)" })).toBeTruthy();
    expect(activity().querySelectorAll(".recharts-line").length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Hafta" }));
    await waitFor(() => expect(activity().querySelectorAll(".recharts-line").length).toBe(2));
    expect(within(activity()).getByRole("button", { name: "Faol foydalanuvchilar" })).toBeTruthy();
    fireEvent.click(within(activity()).getByRole("button", { name: /Jadval/ }));
    // days before activity tracking are "—", not 0
    expect(within(activity()).getAllByRole("cell").some((c) => c.textContent === "—")).toBe(true);
  });

  it("shows created objects one application at a time", async () => {
    serve(byGranularity);
    renderAt("/");
    const panel = await screen.findByRole("region", { name: "Obyektlar dinamikasi" });
    const appSelect = within(panel).getByLabelText("Grafikdagi ilova") as HTMLSelectElement;
    expect(appSelect.value).toBe("jobs");
    fireEvent.change(appSelect, { target: { value: "wallet" } });
    expect(appSelect.value).toBe("wallet");
  });

  it("shows the funnel per channel and links the GUDS-142 admin list", async () => {
    serve(byGranularity);
    renderAt("/");
    const funnel = await screen.findByRole("region", { name: "OTP → ro'yxatdan o'tish" });
    expect(within(funnel).getAllByRole("listitem").map((s) => s.textContent?.split(/\d/)[0])).toEqual([
      "OTP yuborildi",
      "Provayder qabul qildi",
      "Yetkazildi",
      "Kod kiritildi",
      "Ro'yxatdan o'tdi",
    ]);
    fireEvent.click(within(funnel).getByRole("button", { name: /Jadval/ }));
    expect(within(funnel).getByRole("row", { name: /^Email/ }).textContent).toContain("n/a"); // no delivery reports

    const metric = dayFixture.data.summary.authentication.sms_delivered_not_registered;
    const link = screen.getByRole("link", { name: /admin panelda ochish/ }) as HTMLAnchorElement;
    expect(link.href).toBe(new URL(metric.admin_url!, API_BASE).toString());
    expect(link.href).toContain("funnel=delivered_not_registered&created_from=2026-10-02&created_to=2026-10-15");
    expect(link.target).toBe("_blank");
  });

  it("shows the count without a link to viewers without SMS log access", async () => {
    const noLink = clone(dayFixture);
    noLink.data.summary.authentication.sms_delivered_not_registered.admin_url = null as unknown as string;
    serve(() => json(noLink));
    renderAt("/");
    await screen.findByText("SMS yetkazildi, lekin ro'yxatdan o'tilmadi");
    expect(screen.queryByRole("link", { name: /admin panelda/ })).toBeNull();
    expect(screen.getByText(/SMS loglarini ko'rish huquqi kerak/)).toBeTruthy();
  });

  it("notes that dimension filters do not apply to the funnel", async () => {
    serve(byGranularity);
    renderAt("/?country=UZ");
    expect(await screen.findByText("Davlat, usul va ilova filtrlari voronkaga ta'sir qilmaydi")).toBeTruthy();
  });

  it("shows distributions with counts and shares of the period's registrations", async () => {
    serve(byGranularity);
    renderAt("/");
    const panel = await screen.findByRole("region", { name: "Davlatlar bo'yicha" });
    const total = dayFixture.data.summary.users.new_registrations.value;
    expect(panel.textContent).toContain(`jami ${total} (100%)`);
    const items = within(panel).getAllByRole("listitem");
    expect(items).toHaveLength(dayFixture.data.breakdowns.country.length);
    expect(items[0].textContent).toContain("50%");
    expect(items[1].textContent).toContain("Noma'lum");
  });
});

describe("redesigned controls", () => {
  it("names active dimension filters as chips that remove themselves", async () => {
    serve(byGranularity);
    const router = renderAt("/?country=UZ&app=jobs");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    const chips = screen.getByLabelText("Faol filtrlar");
    expect(chips.textContent).toContain("Davlat:");
    expect(chips.textContent).toContain("Ilova:");
    fireEvent.click(within(chips).getByRole("button", { name: "Davlat filtrini olib tashlash" }));
    await waitFor(() => expect(router.state.location.search).toBe("?app=jobs"));
  });

  it("sorts a table view by a column, highest first for numbers, and back", async () => {
    serve(byGranularity);
    renderAt("/");
    const panel = await screen.findByRole("region", { name: "Ro'yxatdan o'tishlar" });
    fireEvent.click(within(panel).getByRole("button", { name: /Jadval/ }));
    const totals = () => within(panel).getAllByRole("row").slice(1).map((r) => Number(r.children[1].textContent));
    const original = totals();
    fireEvent.click(within(panel).getByRole("button", { name: "Jami" }));
    expect(totals()).toEqual([...original].sort((a, b) => b - a));
    expect(within(panel).getByRole("columnheader", { name: "Jami" }).getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(within(panel).getByRole("button", { name: "Jami" }));
    expect(totals()).toEqual([...original].sort((a, b) => a - b));
    fireEvent.click(within(panel).getByRole("button", { name: "Jami" }));
    expect(totals()).toEqual(original);
  });

  it("shows daily-works and payment outcomes as headline cards", async () => {
    serve(byGranularity);
    renderAt("/");
    const section = (await screen.findByRole("heading", { name: "Kunlik ishlar va to'lovlar" })).closest("section")!;
    for (const label of ["Bajarilgan ishlar", "Bekor qilingan ishlar", "Tasdiqlangan to'lovlar", "Muvaffaqiyatsiz to'lovlar"]) {
      expect(within(section).getByText(label)).toBeTruthy();
    }
  });

  it("refreshes on demand without reusing the cached response", async () => {
    serve(byGranularity);
    renderAt("/");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");
    fireEvent.click(screen.getByRole("button", { name: "Yangilash" }));
    await waitFor(() => expect(overviewCalls()).toHaveLength(2));
  });
});

describe("CSV export", () => {
  it("downloads the complete table with the selected filters", async () => {
    serve((url) =>
      url.pathname === "/api/stats/overview/export/"
        ? new Response("﻿Period,From\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8" } })
        : byGranularity(url),
    );
    const createObjectURL = vi.fn(() => "blob:csv");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clicks: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });

    renderAt("/?period=custom&date_from=2026-10-02&date_to=2026-10-15&granularity=week&country=UZ");
    const panel = await screen.findByRole("region", { name: "Ro'yxatdan o'tishlar" });
    fireEvent.click(within(panel).getByRole("button", { name: /CSV yuklab olish/ }));
    await waitFor(() => expect(clicks).toEqual(["guds-stats-registrations-2026-10-02_2026-10-15.csv"]));

    const exportCall = fetchMock.mock.calls
      .map(([input]) => new URL(input as string))
      .find((url) => url.pathname === "/api/stats/overview/export/")!;
    expect(Object.fromEntries(exportCall.searchParams)).toEqual({
      date_from: "2026-10-02",
      date_to: "2026-10-15",
      granularity: "week",
      country: "UZ",
      table: "registrations",
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
