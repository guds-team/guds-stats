import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Clock3, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../layout/AppShell";
import { PageHeader } from "../layout/Page";
import { PeriodSelect } from "./PeriodSelect";
import { DashboardSkeleton, ErrorState } from "./states";
import { Button } from "../ui/button";
import { ApiError } from "../../lib/api";
import { formatDateTime, formatRange, todayInStatsTimezone } from "../../lib/dates";
import { GRANULARITIES, parseFilters, presetRange, serializeFilters, type Granularity, type Preset } from "../../lib/filters";
import { granularityLabel } from "../../lib/metrics";
import { useReport, type ReportMeta, type ReportState } from "../../lib/reports";

export interface ReportFilters {
  period: Preset;
  date_from: string;
  date_to: string;
  granularity: Granularity;
}

/**
 * URL-backed period + granularity of a module report (plus `extra` query
 * keys the page owns, e.g. ?market=food), and the report itself.
 */
export function useReportPage<T>(path: string, extra: Record<string, string> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayInStatsTimezone(), []);
  const filters: ReportFilters = useMemo(() => {
    const { period, date_from, date_to, granularity } = parseFilters(searchParams, today);
    return { period, date_from, date_to, granularity };
  }, [searchParams, today]);
  const [from, to] = presetRange(filters.period, today, { from: filters.date_from, to: filters.date_to });
  const extraKey = new URLSearchParams(extra).toString();

  const serialize = useCallback(
    (next: ReportFilters) => {
      const query = serializeFilters({ ...next, country: "", registered_via: "", app: "" });
      for (const [k, v] of new URLSearchParams(extraKey)) if (v) query.set(k, v);
      return query;
    },
    [extraKey],
  );
  useEffect(() => {
    const canonical = serialize(filters);
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [filters, searchParams, setSearchParams, serialize]);

  const setFilters = (next: Partial<ReportFilters>) => {
    const query = serialize({ ...filters, ...next });
    if (query.toString() !== searchParams.toString()) setSearchParams(query);
  };

  const params = useMemo(
    () => ({ date_from: from, date_to: to, granularity: filters.granularity, ...Object.fromEntries(new URLSearchParams(extraKey)) }),
    [from, to, filters.granularity, extraKey],
  );
  const report = useReport<T>(path, params);
  return { filters, setFilters, from, to, today, report };
}

function GranularitySwitch({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("filters.granularity")} className="inline-flex h-9 rounded-lg border bg-muted/50 p-0.5">
      {GRANULARITIES.map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={value === g}
          onClick={() => onChange(g)}
          className={`rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            value === g ? "bg-background font-medium text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {granularityLabel(g)}
        </button>
      ))}
    </div>
  );
}

/**
 * Page frame of a module report: header with period and freshness, filter
 * bar, error / loading states, then `children(data)` once data arrives.
 */
export function ReportLayout<T extends { meta: ReportMeta }>({
  title,
  description,
  page,
  state,
  controls,
  forbidden,
  children,
}: {
  title: string;
  description: string;
  /** Path of this page, for the login redirect when the session expires. */
  page: string;
  state: ReturnType<typeof useReportPage<T>>;
  /** Extra filter controls next to the period. */
  controls?: React.ReactNode;
  /** Message for 403 when the page needs more than the dashboard permission. */
  forbidden?: string;
  children: (data: T) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, setFilters, from, to, today, report } = state;

  const sessionExpired = report.status === "error" && report.error instanceof ApiError && report.error.status === 401;
  useEffect(() => {
    if (sessionExpired) {
      endSession();
      toast.error(t("auth.sessionExpired"));
      navigate(`/login?next=${encodeURIComponent(`${page}?${searchParams}`)}`, { replace: true });
    }
  }, [sessionExpired, navigate, searchParams, page, t]);

  const data = (report as ReportState<T>).data;
  const loading = report.status === "loading";

  return (
    <AppShell
      status={
        loading && data && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span className="hidden sm:inline">{t("common.refreshing")}</span>
          </span>
        )
      }
    >
      <PageHeader
        title={title}
        description={description}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t("dashboard.periodMeta", { range: formatRange(from, to) })}
            </span>
            {data && (
              <>
                <span>
                  {t("dashboard.comparison", {
                    range: formatRange(data.meta.previous_period.date_from, data.meta.previous_period.date_to),
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  {t("dashboard.generatedAt", { time: formatDateTime(data.meta.generated_at) })}
                </span>
              </>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={report.retry} disabled={loading}>
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {t("common.refresh")}
          </Button>
        }
      />

      <form
        role="search"
        aria-label={t("filters.label")}
        onSubmit={(e) => e.preventDefault()}
        className="rounded-xl border bg-card p-2.5 shadow-card"
      >
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect id="r" value={filters} range={[from, to]} today={today} onChange={(next) => setFilters(next)} />
          <GranularitySwitch value={filters.granularity} onChange={(granularity) => setFilters({ granularity })} />
          {controls}
        </div>
      </form>

      {report.status === "error" && !sessionExpired && (
        <ErrorState
          message={
            report.error instanceof ApiError && report.error.status === 403
              ? (forbidden ?? t("errors.forbidden"))
              : report.error instanceof ApiError
                ? report.error.message
                : t("errors.network")
          }
          onRetry={report.retry}
        />
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        <main className={`space-y-6 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
          {children(data)}
        </main>
      )}
    </AppShell>
  );
}
