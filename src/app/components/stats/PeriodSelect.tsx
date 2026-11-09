import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { addDays, formatRange } from "../../lib/dates";
import { MAX_RANGE_DAYS, PRESETS, presetRange, type Preset } from "../../lib/filters";
import { presetLabel } from "../../lib/metrics";

export const controlClass =
  "h-9 rounded-lg border bg-background pr-8 pl-3 text-sm transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export interface PeriodValue {
  period: Preset;
  date_from: string;
  date_to: string;
}

/**
 * Preset period plus the two date inputs of a custom range. `range` is what
 * the current value resolves to, so switching to "custom" starts from it.
 */
export function PeriodSelect({
  id,
  value,
  range,
  today,
  onChange,
}: {
  id: string;
  value: PeriodValue;
  range: [string, string];
  today: string;
  onChange: (next: PeriodValue) => void;
}) {
  const { t } = useTranslation();

  const choose = (period: Preset) => {
    if (period === "custom") onChange({ period, date_from: range[0], date_to: range[1] });
    else onChange({ period, date_from: "", date_to: "" });
  };
  const setCustom = (field: "date_from" | "date_to", picked: string) => {
    if (!picked) return;
    let date_from = field === "date_from" ? picked : value.date_from;
    let date_to = field === "date_to" ? picked : value.date_to;
    if (date_from > date_to) {
      if (field === "date_from") date_to = date_from;
      else date_from = date_to;
    }
    onChange({ period: "custom", date_from, date_to });
  };

  return (
    <>
      <div className="relative flex min-w-0 items-center">
        <label htmlFor={`${id}-period`} className="sr-only">{t("filters.period")}</label>
        <CalendarDays className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <select
          id={`${id}-period`}
          className={`${controlClass} max-w-full pl-8 font-medium`}
          value={value.period}
          onChange={(e) => choose(e.target.value as Preset)}
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {presetLabel(p)}
              {p !== "custom" ? ` · ${formatRange(...presetRange(p, today))}` : ""}
            </option>
          ))}
        </select>
      </div>
      {value.period === "custom" && (
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`${id}-from`}>{t("filters.dateFrom")}</label>
          <input
            id={`${id}-from`}
            type="date"
            className={`${controlClass} pr-2`}
            value={value.date_from}
            min={addDays(value.date_to || today, -(MAX_RANGE_DAYS - 1))}
            max={today}
            onChange={(e) => setCustom("date_from", e.target.value)}
          />
          <span className="text-muted-foreground" aria-hidden>–</span>
          <label className="sr-only" htmlFor={`${id}-to`}>{t("filters.dateTo")}</label>
          <input
            id={`${id}-to`}
            type="date"
            className={`${controlClass} pr-2`}
            value={value.date_to}
            max={today}
            onChange={(e) => setCustom("date_to", e.target.value)}
          />
        </div>
      )}
    </>
  );
}
