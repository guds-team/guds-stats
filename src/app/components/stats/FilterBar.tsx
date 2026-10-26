import { RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { addDays, formatRange } from "../../lib/dates";
import {
  APPS,
  DEFAULT_FILTERS,
  GRANULARITIES,
  MAX_RANGE_DAYS,
  PRESETS,
  REGISTRATION_METHODS,
  presetRange,
  serializeFilters,
  type ApiParams,
  type Filters,
  type Preset,
} from "../../lib/filters";
import { APP_LABELS, COUNTRY_OPTIONS, GRANULARITY_LABELS, METHOD_LABELS, PRESET_LABELS, countryLabel } from "../../lib/metrics";

const controlClass =
  "h-9 w-full rounded-md border bg-input-background px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterBar({
  filters,
  params,
  today,
  onChange,
}: {
  filters: Filters;
  params: ApiParams;
  today: string;
  onChange: (next: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const choosePeriod = (period: Preset) => {
    // A custom range starts from what is on screen.
    if (period === "custom") set({ period, date_from: params.date_from, date_to: params.date_to });
    else set({ period, date_from: "", date_to: "" });
  };

  const setCustom = (field: "date_from" | "date_to", value: string) => {
    if (!value) return;
    let date_from = field === "date_from" ? value : filters.date_from;
    let date_to = field === "date_to" ? value : filters.date_to;
    // Moving one end past the other drags the other end along.
    if (date_from > date_to) {
      if (field === "date_from") date_to = date_from;
      else date_from = date_to;
    }
    set({ date_from, date_to });
  };

  const countryOptions =
    filters.country && !COUNTRY_OPTIONS.includes(filters.country) ? [filters.country, ...COUNTRY_OPTIONS] : COUNTRY_OPTIONS;
  const isDefault = serializeFilters(filters).toString() === "";

  return (
    <form
      role="search"
      aria-label="Statistika filtrlari"
      onSubmit={(e) => e.preventDefault()}
      className="rounded-2xl border bg-card shadow-sm p-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1.3fr_auto_1fr_1fr_1fr_auto] xl:items-end">
        <Field id="f-period" label="Davr">
          <select
            id="f-period"
            className={controlClass}
            value={filters.period}
            onChange={(e) => choosePeriod(e.target.value as Preset)}
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
                {p !== "custom" ? ` · ${formatRange(...presetRange(p, today))}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex min-w-0 flex-col gap-1">
          <span id="f-granularity" className="text-xs font-medium text-muted-foreground">
            Guruhlash
          </span>
          <div role="group" aria-labelledby="f-granularity" className="inline-flex h-9 rounded-md border">
            {GRANULARITIES.map((g, i) => (
              <button
                key={g}
                type="button"
                aria-pressed={filters.granularity === g}
                onClick={() => set({ granularity: g })}
                className={[
                  "flex-1 px-3 text-sm focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring",
                  i > 0 ? "border-l" : "rounded-l-md",
                  i === GRANULARITIES.length - 1 ? "rounded-r-md" : "",
                  filters.granularity === g ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                ].join(" ")}
              >
                {GRANULARITY_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <Field id="f-country" label="Davlat">
          <select id="f-country" className={controlClass} value={filters.country} onChange={(e) => set({ country: e.target.value })}>
            <option value="">Barcha davlatlar</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {countryLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="f-method" label="Ro'yxatdan o'tish usuli">
          <select
            id="f-method"
            className={controlClass}
            value={filters.registered_via}
            onChange={(e) => set({ registered_via: e.target.value })}
          >
            <option value="">Barcha usullar</option>
            {REGISTRATION_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="f-app" label="Ilova">
          <select id="f-app" className={controlClass} value={filters.app} onChange={(e) => set({ app: e.target.value })}>
            <option value="">Barcha ilovalar</option>
            {APPS.map((a) => (
              <option key={a} value={a}>
                {APP_LABELS[a]}
              </option>
            ))}
          </select>
        </Field>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 self-end"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Tozalash
        </Button>
      </div>

      {filters.period === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <Field id="f-from" label="Boshlanish sanasi">
            <input
              id="f-from"
              type="date"
              className={controlClass}
              value={filters.date_from}
              min={addDays(filters.date_to || today, -(MAX_RANGE_DAYS - 1))}
              max={today}
              onChange={(e) => setCustom("date_from", e.target.value)}
            />
          </Field>
          <Field id="f-to" label="Tugash sanasi">
            <input
              id="f-to"
              type="date"
              className={controlClass}
              value={filters.date_to}
              max={today}
              onChange={(e) => setCustom("date_to", e.target.value)}
            />
          </Field>
        </div>
      )}
    </form>
  );
}
