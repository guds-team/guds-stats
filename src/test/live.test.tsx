import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/routes";
import { liveUrl, type LiveSnapshot } from "../app/lib/live";
// Real snapshot of the guds backend (apps/statistics/live.py on its test dataset).
import fixture from "./fixtures/live-snapshot.json";

const snapshot = fixture as LiveSnapshot;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    act(() => this.onopen?.());
  }
  push(data: LiveSnapshot) {
    act(() => this.onmessage?.({ data: JSON.stringify({ type: "snapshot", data }) }));
  }
  drop(code: number) {
    this.readyState = 3;
    act(() => this.onclose?.({ code }));
  }
}

const socket = () => FakeSocket.instances[FakeSocket.instances.length - 1];

/** Renders the page and waits for its (lazily loaded) module to open the socket. */
async function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(FakeSocket.instances.length).toBeGreaterThan(0));
  return router;
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  localStorage.setItem("access_token", "token");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("live page", () => {
  it("connects with the session token over wss", async () => {
    await renderAt("/live");
    expect(socket().url).toBe(liveUrl("token"));
    expect(socket().url).toMatch(/^wss:\/\/.+\/ws\/stats\/live\/\?token=token$/);
  });

  it("shows counters, charts and both tables from a snapshot", async () => {
    await renderAt("/live");
    expect(screen.getByLabelText("Yuklanmoqda")).toBeTruthy();
    socket().open();
    socket().push(snapshot);

    expect(screen.getByRole("status").textContent).toContain("Jonli");
    const workersKpi = screen.getByText("Onlayn ishchilar", { selector: "p" }).closest("div.kpi-card") as HTMLElement;
    expect(within(workersKpi).getByText("3")).toBeTruthy();
    expect(screen.getByText("Bugun joylangan", { selector: "p" })).toBeTruthy();

    const table = screen.getByRole("region", { name: "Onlayn ishchilar" });
    expect(within(table).getByText("Aziz Karimov")).toBeTruthy();
    expect(within(table).getByText("JOB-F65AB6282A21")).toBeTruthy();

    // State chip filters the workers.
    fireEvent.click(within(table).getByRole("button", { name: /^Ishda/ }));
    expect(within(table).queryByText("Aziz Karimov")).toBeNull();
    expect(within(table).getByText("Dilshod Toshev")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Ishlar/ }));
    const jobs = screen.getByRole("region", { name: "Faol ishlar" });
    expect(within(jobs).getAllByText("Malika Yusupova").length).toBe(3);
    fireEvent.change(within(jobs).getByRole("searchbox"), { target: { value: "Dilshod" } });
    expect(within(jobs).getAllByText("Malika Yusupova").length).toBe(1);
  });

  it("updates in place when the server pushes a change", async () => {
    await renderAt("/live");
    socket().open();
    socket().push(snapshot);
    const next = clone(snapshot);
    next.workers = next.workers.filter((w) => w.state !== "online_idle");
    next.counts.workers = { ...next.counts.workers, total: 2, online_idle: 0 };
    socket().push(next);

    expect(screen.queryByText("Aziz Karimov")).toBeNull();
    const meter = screen.getByRole("img", { name: /Bo'sh, kutmoqda: 0/ });
    expect(meter).toBeTruthy();
  });

  it("asks for a fresh snapshot on Yangilash", async () => {
    await renderAt("/live");
    socket().open();
    socket().push(snapshot);
    fireEvent.click(screen.getByRole("button", { name: /Yangilash/ }));
    expect(socket().sent).toContainEqual({ type: "refresh" });
  });

  it("reconnects after a dropped connection", async () => {
    await renderAt("/live");
    vi.useFakeTimers();
    socket().open();
    socket().drop(1006);
    expect(screen.getByRole("status").textContent).toContain("Qayta ulanmoqda");
    act(() => vi.advanceTimersByTime(1_000));
    expect(FakeSocket.instances.length).toBe(2);
  });

  it("explains a missing permission instead of retrying", async () => {
    await renderAt("/live");
    vi.useFakeTimers();
    socket().drop(4003);
    expect(screen.getByRole("alert").textContent).toContain("huquqi yo'q");
    act(() => vi.advanceTimersByTime(30_000));
    expect(FakeSocket.instances.length).toBe(1);
  });

  it("sends an expired session back to login", async () => {
    const router = await renderAt("/live");
    socket().drop(4001);
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Flive");
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});
