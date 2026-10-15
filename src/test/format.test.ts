import { describe, expect, it } from "vitest";
import { describeChange, formatNumber, formatPercent } from "../app/lib/format";
import type { Compared } from "../app/lib/types";

const metric = (value: number | null, previous: number | null, comparison: Compared["comparison"]): Compared => ({
  value,
  previous,
  change: value !== null && previous !== null ? value - previous : null,
  change_percent:
    comparison === "ok" && value !== null && previous ? Math.round(((value - previous) * 10000) / previous) / 100 : null,
  comparison,
});

describe("describeChange", () => {
  it("shows the percentage change with its direction", () => {
    expect(describeChange(metric(15, 10, "ok"), "up_is_good")).toEqual({ trend: "up", tone: "good", text: "+50%" });
    expect(describeChange(metric(5, 10, "ok"), "up_is_good")).toEqual({ trend: "down", tone: "bad", text: "−50%" });
  });

  it("colours by the metric's meaning, not by the sign", () => {
    expect(describeChange(metric(15, 10, "ok"), "up_is_bad").tone).toBe("bad");
    expect(describeChange(metric(5, 10, "ok"), "up_is_bad").tone).toBe("good");
    expect(describeChange(metric(15, 10, "ok"), "neutral").tone).toBe("neutral");
  });

  it("never divides by a zero previous value", () => {
    expect(describeChange(metric(4, 0, "previous_zero"), "up_is_good")).toEqual({
      trend: "up",
      tone: "good",
      text: "+4 (oldingi davrda 0)",
    });
    expect(describeChange(metric(0, 0, "no_change"), "up_is_good")).toEqual({
      trend: "flat",
      tone: "neutral",
      text: "O'zgarishsiz",
    });
  });

  it("does not compare unknown values", () => {
    expect(describeChange(metric(3, null, "unavailable"), "up_is_good").text).toBe("Taqqoslab bo'lmaydi");
    expect(describeChange(metric(null, null, "unsupported"), "up_is_good").trend).toBe("none");
  });
});

it("formats missing values as a dash, never as 0", () => {
  expect(formatNumber(null)).toBe("—");
  expect(formatNumber(undefined)).toBe("—");
  expect(formatNumber(0)).toBe("0");
  expect(formatPercent(null)).toBe("—");
  expect(formatPercent(33.33)).toBe("33,33%");
  expect(formatNumber(1234567).replace(/\s/g, " ")).toBe("1 234 567");
});
