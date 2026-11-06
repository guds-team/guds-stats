import { cloneElement, type ReactElement } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import i18n, { DEFAULT_LANGUAGE } from "../app/lib/i18n";

// jsdom reports an en-US browser: every test starts in the default (Uzbek)
// interface, as a visitor without a saved choice and an Uzbek browser would.
beforeEach(async () => {
  await i18n.changeLanguage(DEFAULT_LANGUAGE);
});

afterEach(() => cleanup());

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no layout: ResponsiveContainer would measure 0×0 and draw nothing.
vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <div style={{ width: 800, height: 280 }}>{cloneElement(children, { width: 800, height: 280 } as object)}</div>
    ),
  };
});
