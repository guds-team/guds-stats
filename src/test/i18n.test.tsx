import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/routes";
import { apiGet } from "../app/lib/api";
import { formatDay, formatRange } from "../app/lib/dates";
import { describeChange, formatMoney, formatNumber, formatPercent, formatSince } from "../app/lib/format";
import i18n, {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  currentLanguage,
  detectLanguage,
  readStoredLanguage,
  setLanguage,
  type Language,
} from "../app/lib/i18n";
import { countryLabel, methodLabel, objectLabel } from "../app/lib/metrics";
import { clearOverviewCache } from "../app/lib/useOverview";
import uz from "../locales/uz.json";
import ru from "../locales/ru.json";
import en from "../locales/en.json";
import dayFixture from "./fixtures/overview-day.json";
import liveFixture from "./fixtures/live-snapshot.json";

const RESOURCES: Record<Language, unknown> = { uz, ru, en };
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Leaf = { path: string; value: unknown };

function leaves(node: unknown, path = ""): Leaf[] {
  if (node !== null && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      leaves(value, Array.isArray(node) ? `${path}[${key}]` : path ? `${path}.${key}` : key),
    );
  }
  return [{ path, value: node }];
}

/** Every key path with its kind ("object" / "array" / "string" …), plural suffixes folded into one base key. */
function shape(node: unknown, path = "", out = new Map<string, string>()): Map<string, string> {
  const kind = Array.isArray(node) ? "array" : node === null ? "null" : typeof node;
  if (path) out.set(path.replace(PLURAL_SUFFIX, ""), kind);
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) shape(value, path ? `${path}.${key}` : key, out);
  }
  return out;
}

function pluralForms(resource: unknown): Map<string, Set<string>> {
  const forms = new Map<string, Set<string>>();
  for (const { path } of leaves(resource)) {
    const match = path.match(PLURAL_SUFFIX);
    if (!match) continue;
    const base = path.replace(PLURAL_SUFFIX, "");
    forms.set(base, (forms.get(base) ?? new Set()).add(match[1]));
  }
  return forms;
}

const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)[^}]*}}/g)].map((m) => m[1]).sort();

describe("translation resources", () => {
  it("have the same nested key structure in every language", () => {
    const problems: string[] = [];
    for (const source of LANGUAGES) {
      const sourceShape = shape(RESOURCES[source]);
      for (const target of LANGUAGES) {
        if (target === source) continue;
        const targetShape = shape(RESOURCES[target]);
        for (const [key, kind] of sourceShape) {
          if (!targetShape.has(key)) problems.push(`${target}.json is missing "${key}" (present in ${source}.json)`);
          else if (targetShape.get(key) !== kind)
            problems.push(`"${key}" is ${targetShape.get(key)} in ${target}.json but ${kind} in ${source}.json`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("give every plural key all the forms its language needs", () => {
    const problems: string[] = [];
    const bases = new Set(LANGUAGES.flatMap((l) => [...pluralForms(RESOURCES[l]).keys()]));
    for (const language of LANGUAGES) {
      const forms = pluralForms(RESOURCES[language]);
      const needed = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
      for (const base of bases) {
        for (const category of needed) {
          if (!forms.get(base)?.has(category)) problems.push(`${language}.json is missing "${base}_${category}"`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("have no empty, blank or non-string values", () => {
    const problems = LANGUAGES.flatMap((language) =>
      leaves(RESOURCES[language])
        .filter(({ value }) => typeof value !== "string" || value.trim() === "")
        .map(({ path, value }) => `${language}.json "${path}" is ${JSON.stringify(value)}`),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("never contain a translation key instead of text", () => {
    const keys = new Set(LANGUAGES.flatMap((l) => leaves(RESOURCES[l]).map(({ path }) => path.replace(PLURAL_SUFFIX, ""))));
    const problems = LANGUAGES.flatMap((language) =>
      leaves(RESOURCES[language])
        .filter(({ value }) => typeof value === "string" && (keys.has(value) || /^[a-z]+(\.[A-Za-z_]+)+$/.test(value)))
        .map(({ path, value }) => `${language}.json "${path}" looks like a key: ${value}`),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("use the same interpolation values in every language", () => {
    const problems: string[] = [];
    const byBase = (language: Language) => {
      const map = new Map<string, string[]>();
      for (const { path, value } of leaves(RESOURCES[language])) {
        const base = path.replace(PLURAL_SUFFIX, "");
        map.set(base, [...new Set([...(map.get(base) ?? []), ...placeholders(String(value))])].sort());
      }
      return map;
    };
    const reference = byBase(DEFAULT_LANGUAGE);
    for (const language of LANGUAGES) {
      for (const [key, values] of byBase(language)) {
        if (JSON.stringify(values) !== JSON.stringify(reference.get(key)))
          problems.push(`"${key}": ${language}.json uses {${values}} but ${DEFAULT_LANGUAGE}.json uses {${reference.get(key)}}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("are all loaded, and resolve in each language without the fallback", () => {
    const problems: string[] = [];
    const keys = new Set(LANGUAGES.flatMap((l) => leaves(RESOURCES[l]).map(({ path }) => path)));
    for (const language of LANGUAGES) {
      for (const key of keys) {
        const base = key.replace(PLURAL_SUFFIX, "");
        const needed = PLURAL_SUFFIX.test(key)
          ? new Intl.PluralRules(language).resolvedOptions().pluralCategories.map((c) => `${base}_${c}`)
          : [key];
        for (const own of needed) {
          // The language's own bundle, as i18next loaded it: no fallback involved.
          const value = i18n.getResource(language, "translation", own);
          if (typeof value !== "string" || !value.trim()) problems.push(`${language}: "${own}" does not resolve`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("language detection", () => {
  afterEach(() => localStorage.clear());

  it.each([
    [["uz"], "uz"],
    [["uz-UZ"], "uz"],
    [["uz-Latn-UZ"], "uz"],
    [["ru"], "ru"],
    [["ru-RU"], "ru"],
    [["en"], "en"],
    [["en-US"], "en"],
    [["en-GB"], "en"],
    [["de-DE", "ru-RU", "en"], "ru"], // first supported of the browser's list
    [["de-DE"], "uz"],
    [["fr", "es"], "uz"],
    [[], "uz"],
  ] as const)("browser %j → %s", (preferred, expected) => {
    expect(detectLanguage(null, preferred)).toBe(expected);
  });

  it("prefers a saved choice over the browser", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    expect(detectLanguage(undefined, ["ru-RU"])).toBe("en");
  });

  it("ignores an invalid saved value", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "de");
    expect(readStoredLanguage()).toBeNull();
    expect(detectLanguage(undefined, ["ru-RU"])).toBe("ru");
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "EN; drop table");
    expect(detectLanguage(undefined, [])).toBe("uz");
  });

  it("keeps working when storage is unavailable", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    try {
      expect(detectLanguage(undefined, ["en-US"])).toBe("en");
      await setLanguage("ru");
      expect(currentLanguage()).toBe("ru");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("switching the language", () => {
  afterEach(() => localStorage.clear());

  it("changes the active language and remembers it", async () => {
    await setLanguage("ru");
    expect(i18n.language).toBe("ru");
    expect(currentLanguage()).toBe("ru");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ru");
    expect(detectLanguage(undefined, ["en-US"])).toBe("ru"); // the next visit restores it
  });

  it("updates <html lang> and the document title", async () => {
    expect(document.documentElement.lang).toBe("uz");
    expect(document.title).toBe("GUDS Stats — Statistika paneli");
    await setLanguage("ru");
    expect(document.documentElement.lang).toBe("ru");
    expect(document.title).toBe("GUDS Stats — Панель статистики");
    await setLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("GUDS Stats — Analytics Dashboard");
  });
});

describe("locale formatting", () => {
  const nbsp = (text: string) => text.replace(/[  ]/g, " ");

  it("formats numbers and percentages per language", () => {
    expect(nbsp(formatNumber(1234567.5, "uz"))).toBe("1 234 567,5");
    expect(nbsp(formatNumber(1234567.5, "ru"))).toBe("1 234 567,5");
    expect(formatNumber(1234567.5, "en")).toBe("1,234,567.5");
    expect(formatPercent(33.33, "en")).toBe("33.33%");
    expect(nbsp(formatPercent(33.33, "ru"))).toBe("33,33 %");
    for (const language of LANGUAGES) {
      expect(formatNumber(null, language)).toBe("—");
      expect(formatNumber(Number.NaN, language)).toBe("—");
      expect(formatPercent(undefined, language)).toBe("—");
    }
  });

  it("follows the active language when none is passed", async () => {
    await setLanguage("en");
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(describeChange({ value: 1, previous: null, change: null, change_percent: null, comparison: "unavailable" }, "neutral").text).toBe(
      "Not comparable",
    );
  });

  it("formats money with the currency name of the language", () => {
    expect(nbsp(formatMoney(1250000, "UZS", false, "uz"))).toBe("1 250 000 so'm");
    expect(nbsp(formatMoney(1250000, "UZS", true, "ru"))).toBe("1,3 млн сум");
    expect(formatMoney(9_450_000, "UZS", true, "en")).toBe("9.5M UZS");
    expect(formatMoney(1500, "USD", false, "en")).toBe("1,500 USD");
    expect(formatMoney(null, "UZS", false, "en")).toBe("—");
  });

  it("formats calendar days without shifting them", () => {
    expect(formatDay("2026-10-12", false, "en")).toBe("Oct 12");
    expect(formatDay("2026-10-12", true, "ru")).toMatch(/^12 окт\.? 2026/);
    expect(formatDay("2026-10-12", false, "uz")).toMatch(/12.okt/);
    expect(formatRange("2026-12-29", "2027-01-04", "en")).toBe("Dec 29, 2026 – Jan 4, 2027");
    expect(formatDay("2026-01-01", true, "en")).toBe("Jan 1, 2026"); // UTC midnight, never Dec 31
  });

  it("uses plural rules for durations", () => {
    const now = Date.parse("2026-10-15T12:00:00Z");
    const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
    expect(formatSince(daysAgo(1), now, "en")).toBe("1 day");
    expect(formatSince(daysAgo(2), now, "en")).toBe("2 days");
    expect(formatSince(daysAgo(2), now, "ru")).toBe("2 дня");
    expect(formatSince(daysAgo(5), now, "ru")).toBe("5 дней");
    expect(formatSince(daysAgo(21), now, "ru")).toBe("21 день");
    expect(formatSince(new Date(now).toISOString(), now, "uz")).toBe("hozirgina");
  });

  it("names countries in the selected language and leaves anything else alone", () => {
    expect(countryLabel("UZ", "ru")).toBe("Узбекистан (UZ)");
    expect(countryLabel("UZ", "en")).toBe("Uzbekistan (UZ)");
    expect(countryLabel("kz", "en")).toBe("Kazakhstan (KZ)");
    expect(countryLabel("unknown", "ru")).toBe("Неизвестно");
    expect(countryLabel("", "en")).toBe("Unknown");
    expect(countryLabel("Uzbekistan", "en")).toBe("Uzbekistan"); // not a code: shown as the API sent it
    expect(countryLabel("U1", "en")).toBe("U1");
  });

  it("translates only known labels and keeps unknown API values", async () => {
    await setLanguage("ru");
    expect(methodLabel("phone")).toBe("Телефон (SMS)");
    expect(methodLabel("carrier_pigeon")).toBe("carrier_pigeon");
    expect(objectLabel("messages_sent")).toBe("Сообщения");
    expect(objectLabel("new_metric", "New metric")).toBe("New metric");
  });
});

// ── The running application ──────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function serve(handler: (url: URL) => Response) {
  fetchMock = vi.fn((input: string) => Promise.resolve(handler(new URL(input))));
  vi.stubGlobal("fetch", fetchMock);
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

function requestHeaders(pathname: string): Record<string, string>[] {
  return fetchMock.mock.calls
    .filter(([input]) => new URL(input as string).pathname === pathname)
    .map(([, init]) => (init as RequestInit).headers as Record<string, string>);
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("Accept-Language", () => {
  beforeEach(() => localStorage.setItem("access_token", "token"));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("goes with every API request in the language active at that moment", async () => {
    serve(() => json({ data: {} }));
    await apiGet("/api/stats/overview/", {});
    await setLanguage("ru");
    await apiGet("/api/stats/overview/", {});
    await setLanguage("en");
    await apiGet("/api/stats/overview/export/", { table: "country" });
    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).headers)).toEqual([
      { "Accept-Language": "uz", Authorization: "Bearer token" },
      { "Accept-Language": "ru", Authorization: "Bearer token" },
      { "Accept-Language": "en", Authorization: "Bearer token" },
    ]);
  });

  it("is sent with the login request, next to its own headers", async () => {
    localStorage.clear();
    serve(() => json({ success: false }));
    renderAt("/login");
    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "909009090" } });
    fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestHeaders("/api/v1/users/auth/simple/login/")[0]).toEqual({
      "Content-Type": "application/json",
      "Accept-Language": "ru",
    });
  });
});

describe("language switch in the application", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T07:00:00Z"));
    localStorage.setItem("access_token", "token");
    clearOverviewCache();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("translates the login page in place", async () => {
    localStorage.clear();
    renderAt("/login");
    expect(screen.getByLabelText("Telefon raqami")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Telefon raqami"), { target: { value: "901234567" } });
    const english = screen.getByRole("button", { name: "English" });
    expect(english.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(english);
    expect(await screen.findByLabelText("Phone number")).toBeTruthy();
    expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("901234567"); // input kept
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("translates the dashboard, keeps the filters and asks the API in the new language", async () => {
    serve((url) =>
      url.pathname === "/api/stats/overview/export/"
        ? new Response("﻿Period\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8" } })
        : json(dayFixture),
    );
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:csv"), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const router = renderAt("/?period=last7&country=UZ");
    await screen.findByText("Yangi ro'yxatdan o'tishlar");

    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    await screen.findByText("Новые регистрации");
    expect(router.state.location.search).toBe("?period=last7&country=UZ"); // filters untouched
    expect((screen.getByLabelText("Страна") as HTMLSelectElement).value).toBe("UZ");
    expect(screen.getByLabelText("Активные фильтры").textContent).toContain("Узбекистан (UZ)");
    expect(screen.getByRole("region", { name: "Регистрации" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Неделя" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ru");

    // Chart legend, table headers and the CSV request follow the language too.
    const panel = screen.getByRole("region", { name: "Регистрации" });
    expect(within(panel).getByRole("button", { name: "Телефон (SMS)" })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: /Таблица/ }));
    expect(within(panel).getByRole("columnheader", { name: "Всего" })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Регистрации: скачать CSV" }));
    await waitFor(() => expect(requestHeaders("/api/stats/overview/export/")).toHaveLength(1));
    expect(requestHeaders("/api/stats/overview/export/")[0]["Accept-Language"]).toBe("ru");

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await screen.findByText("New registrations");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(requestHeaders("/api/stats/overview/").length).toBe(2));
    expect(requestHeaders("/api/stats/overview/")[1]["Accept-Language"]).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    click.mockRestore();
  });

  it("translates the live page", async () => {
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
    renderAt("/live");
    await waitFor(() => expect(Socket.last).toBeTruthy());
    act(() => {
      Socket.last.readyState = 1;
      Socket.last.onopen?.();
      Socket.last.onmessage?.({ data: JSON.stringify({ type: "snapshot", data: liveFixture }) });
    });
    expect(screen.getByRole("status").textContent).toContain("Jonli");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Live"));
    expect(screen.getByRole("region", { name: "Online workers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Worker states" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /State/ })).toBeTruthy();
  });
});
