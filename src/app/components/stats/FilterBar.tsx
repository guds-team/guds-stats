import { AppWindow, CalendarDays, Globe, RotateCcw, UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { COUNTRY_OPTIONS, appLabel, countryLabel, granularityLabel, methodLabel, presetLabel } from "../../lib/metrics";

const controlClass =
  "h-9 rounded-lg border bg-background pr-8 pl-3 text-sm transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** A labelled control: the label stays for screen readers, the chips below name the active values. */
function Field({ id, label, icon: Icon, children }: { id: string; label: string; icon?: typeof Globe; children: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 items-center">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {Icon && <Icon className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
      {children}
    </div>
  );
}

function Chip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("filters.remove", { label })}
        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
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
  const { t } = useTranslation();
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

  const chips = [
    filters.country && { key: "country", label: t("filters.country"), value: countryLabel(filters.country) },
    filters.registered_via && {
      key: "registered_via",
      label: t("filters.methodShort"),
      value: methodLabel(filters.registered_via),
    },
    filters.app && { key: "app", label: t("filters.app"), value: appLabel(filters.app) },
  ].filter(Boolean) as { key: "country" | "registered_via" | "app"; label: string; value: string }[];

  return (
    <form
      role="search"
      aria-label={t("filters.label")}
      onSubmit={(e) => e.preventDefault()}
      className="rounded-xl border bg-card p-2.5 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Field id="f-period" label={t("filters.period")} icon={CalendarDays}>
          <select
            id="f-period"
            className={`${controlClass} max-w-full pl-8 font-medium`}
            value={filters.period}
            onChange={(e) => choosePeriod(e.target.value as Preset)}
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {presetLabel(p)}
                {p !== "custom" ? ` · ${formatRange(...presetRange(p, today))}` : ""}
              </option>
            ))}
          </select>
        </Field>

        {filters.period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Field id="f-from" label={t("filters.dateFrom")}>
              <input
                id="f-from"
                type="date"
                className={`${controlClass} pr-2`}
                value={filters.date_from}
                min={addDays(filters.date_to || today, -(MAX_RANGE_DAYS - 1))}
                max={today}
                onChange={(e) => setCustom("date_from", e.target.value)}
              />
            </Field>
            <span className="text-muted-foreground" aria-hidden>
              –
            </span>
            <Field id="f-to" label={t("filters.dateTo")}>
              <input
                id="f-to"
                type="date"
                className={`${controlClass} pr-2`}
                value={filters.date_to}
                max={today}
                onChange={(e) => setCustom("date_to", e.target.value)}
              />
            </Field>
          </div>
        )}

        <div role="group" aria-label={t("filters.granularity")} className="inline-flex h-9 rounded-lg border bg-muted/50 p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={filters.granularity === g}
              onClick={() => set({ granularity: g })}
              className={`rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                filters.granularity === g
                  ? "bg-background font-medium text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {granularityLabel(g)}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-9 gap-1.5 rounded-lg"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t("filters.reset")}
        </Button>
      </div>

      <div className="mt-2.5 grid gap-2 border-t pt-2.5 sm:grid-cols-3">
        <Field id="f-country" label={t("filters.country")} icon={Globe}>
          <select
            id="f-country"
            className={`${controlClass} w-full pl-8`}
            value={filters.country}
            onChange={(e) => set({ country: e.target.value })}
          >
            <option value="">{t("filters.allCountries")}</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {countryLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="f-method" label={t("filters.method")} icon={UserPlus}>
          <select
            id="f-method"
            className={`${controlClass} w-full pl-8`}
            value={filters.registered_via}
            onChange={(e) => set({ registered_via: e.target.value })}
          >
            <option value="">{t("filters.allMethods")}</option>
            {REGISTRATION_METHODS.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="f-app" label={t("filters.app")} icon={AppWindow}>
          <select id="f-app" className={`${controlClass} w-full pl-8`} value={filters.app} onChange={(e) => set({ app: e.target.value })}>
            <option value="">{t("filters.allApps")}</option>
            {APPS.map((a) => (
              <option key={a} value={a}>
                {appLabel(a)}
              </option>
            ))}
          </select>
        </Field>

      </div>

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t px-0.5 pt-2.5" aria-label={t("filters.active")}>
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} value={chip.value} onRemove={() => set({ [chip.key]: "" })} />
          ))}
        </div>
      )}
    </form>
  );
}
