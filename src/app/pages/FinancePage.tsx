import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock3, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import { PageHeader, SectionCard } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { MetricCard } from "../components/stats/MetricCard";
import { PeriodSelect } from "../components/stats/PeriodSelect";
import { axisProps, gridProps } from "../components/stats/chartParts";
import { DashboardSkeleton, EmptyState, ErrorState } from "../components/stats/states";
import { Button } from "../components/ui/button";
import { ApiError } from "../lib/api";
import { addDays, daysBetween, formatDateTime, formatDay, formatRange, todayInStatsTimezone } from "../lib/dates";
import { parseFilters, presetRange, serializeFilters, type Preset } from "../lib/filters";
import { formatMoney, formatNumber, formatPercent } from "../lib/format";
import { useJobsReport, type JobsReport, type PersonTotal } from "../lib/jobs";
import { compareValues } from "../lib/metrics";

/** The equally long period right before [from, to]. */
export function previousRange(from: string, to: string): [string, string] {
  const days = daysBetween(from, to) + 1;
  return [addDays(from, -days), addDays(from, -1)];
}

interface Totals {
  revenue: number;
  commission: number;
  payout: number;
  average: number | null;
  jobs: number;
  workers: number;
  clients: number;
}

function totalsOf(report: JobsReport): Totals {
  const { revenue, commission, jobs, workers, clients } = report.totals;
  return { revenue, commission, payout: revenue - commission, average: jobs ? revenue / jobs : null, jobs, workers, clients };
}

const money = (value: number | null) => formatMoney(value, "UZS", true);

function TurnoverChart({ days, previous }: { days: JobsReport["days"]; previous: JobsReport["days"] | undefined }) {
  const { t } = useTranslation();
  // Day i of the period against day i of the previous one (same length).
  const rows = days.map((d, i) => ({ ...d, previous: previous?.[i]?.revenue ?? null, previousDay: previous?.[i]?.day ?? null }));
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="20%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="day" tickFormatter={(d: string) => formatDay(d)} {...axisProps} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickFormatter={(v: number) => formatMoney(v, "UZS", true).replace(` ${t("units.currencyUZS")}`, "")} {...axisProps} width={56} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof rows)[number];
              return (
                <div className="min-w-48 rounded-lg border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg">
                  <p className="mb-1.5 font-medium">{formatDay(p.day, true)}</p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("finance.turnover")}</span><span className="font-medium tabular-nums">{formatMoney(p.revenue)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("finance.jobs")}</span><span className="tabular-nums">{formatNumber(p.jobs)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("finance.workers")}</span><span className="tabular-nums">{formatNumber(p.workers)}</span></p>
                  {p.previousDay && (
                    <p className="mt-1 flex justify-between gap-4 border-t pt-1">
                      <span className="text-muted-foreground">{formatDay(p.previousDay, true)}</span>
                      <span className="tabular-nums">{formatMoney(p.previous)}</span>
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" name={t("finance.turnover")} fill="var(--series-7)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          {previous && (
            <Line dataKey="previous" name={t("finance.previousPeriod")} stroke="var(--chart-axis)" strokeWidth={2}
              strokeDasharray="5 4" dot={false} type="monotone" isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--series-7)]" aria-hidden />{t("finance.turnover")}</li>
      <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[color:var(--chart-axis)]" aria-hidden />{t("finance.previousPeriod")}</li>
    </ul>
  );
}

function PeopleByMoney({ rows, total, caption }: { rows: PersonTotal[]; total: number; caption: string }) {
  const { t } = useTranslation();
  const sorted = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue || b.jobs - a.jobs), [rows]);
  const rank = new Map(sorted.map((p, i) => [p.id, i + 1]));
  const columns: Column<PersonTotal>[] = [
    { key: "rank", header: "#", cell: (p) => <span className="text-muted-foreground tabular-nums">{rank.get(p.id)}</span>, sort: (p) => rank.get(p.id) },
    {
      key: "person",
      header: t("jobs.columns.person"),
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name ?? `#${p.id}`}</p>
          {p.phone && <a href={`tel:${p.phone}`} className="text-xs text-muted-foreground tabular-nums hover:text-foreground">{p.phone}</a>}
        </div>
      ),
      sort: (p) => (p.name ?? "").toLowerCase(),
    },
    { key: "jobs", header: t("finance.jobs"), numeric: true, cell: (p) => formatNumber(p.jobs), sort: (p) => p.jobs },
    { key: "revenue", header: t("finance.turnover"), numeric: true, cell: (p) => formatMoney(p.revenue, "UZS", true), sort: (p) => p.revenue },
    {
      key: "share",
      header: t("finance.share"),
      numeric: true,
      cell: (p) => (total ? formatPercent(Math.round((p.revenue / total) * 1000) / 10) : "—"),
      sort: (p) => p.revenue,
      className: "hidden sm:table-cell",
    },
    {
      key: "average",
      header: t("finance.averageCheck"),
      numeric: true,
      cell: (p) => (p.jobs ? formatMoney(p.revenue / p.jobs, "UZS", true) : "—"),
      sort: (p) => (p.jobs ? p.revenue / p.jobs : null),
      className: "hidden md:table-cell",
    },
  ];
  if (!sorted.length) return <EmptyState />;
  return <DataTable columns={columns} rows={sorted} caption={caption} pageSize={10} rowKey={(p) => p.id} />;
}

/** Turnover per category, from the job rows (complete only while the period fits the row limit). */
function CategoryTurnover({ report }: { report: JobsReport }) {
  const { t } = useTranslation();
  const rows = useMemo(() => {
    const by = new Map<string, { jobs: number; revenue: number }>();
    for (const job of report.jobs) {
      const row = by.get(job.category) ?? { jobs: 0, revenue: 0 };
      row.jobs += 1;
      row.revenue += job.price ?? 0;
      by.set(job.category, row);
    }
    return [...by.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [report.jobs]);
  if (!rows.length) return <EmptyState hint={null} />;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="truncate text-muted-foreground" title={row.category}>
            {row.category} <span className="text-xs">· {t("live.topWorkers.jobs", { count: row.jobs })}</span>
          </span>
          <span className="font-semibold tabular-nums">{formatMoney(row.revenue, "UZS", true)}</span>
          <div className="col-span-2 h-2 rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(row.revenue / max) * 100}%`, background: "var(--series-7)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FinancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayInStatsTimezone(), []);
  const filters = useMemo(() => {
    const { period, date_from, date_to } = parseFilters(searchParams, today);
    return { period, date_from, date_to };
  }, [searchParams, today]);
  const [from, to] = presetRange(filters.period, today, { from: filters.date_from, to: filters.date_to });
  const [prevFrom, prevTo] = previousRange(from, to);
  const params = useMemo(() => ({ date_from: from, date_to: to, status: "completed" }), [from, to]);
  const prevParams = useMemo(() => ({ date_from: prevFrom, date_to: prevTo, status: "completed" }), [prevFrom, prevTo]);
  const report = useJobsReport(params);
  const previous = useJobsReport(prevParams);

  const serialize = useCallback(
    (next: { period: Preset; date_from: string; date_to: string }) =>
      serializeFilters({ ...next, granularity: "day", country: "", registered_via: "", app: "" }),
    [],
  );
  useEffect(() => {
    const canonical = serialize(filters);
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [filters, searchParams, setSearchParams, serialize]);

  const sessionExpired = report.status === "error" && report.error instanceof ApiError && report.error.status === 401;
  useEffect(() => {
    if (sessionExpired) {
      endSession();
      toast.error(t("auth.sessionExpired"));
      navigate(`/login?next=${encodeURIComponent(`/finance?${searchParams}`)}`, { replace: true });
    }
  }, [sessionExpired, navigate, searchParams, t]);

  const data = report.status === "error" ? null : report.data;
  const prev = previous.status === "success" ? previous.data : null;
  const loading = report.status === "loading" || previous.status === "loading";
  const retry = () => {
    report.retry();
    previous.retry();
  };

  const now = data && totalsOf(data);
  const before = prev && totalsOf(prev);
  const compared = (key: keyof Totals) => compareValues(now?.[key] ?? null, before ? before[key] : null);
  const spark = (pick: (d: JobsReport["days"][number]) => number) => data?.days.map(pick);

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
        title={t("finance.title")}
        description={t("finance.description")}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t("dashboard.periodMeta", { range: formatRange(from, to) })}
            </span>
            <span>{t("dashboard.comparison", { range: formatRange(prevFrom, prevTo) })}</span>
            {data && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {t("dashboard.generatedAt", { time: formatDateTime(data.meta.generated_at) })}
              </span>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={retry} disabled={loading}>
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {t("common.refresh")}
          </Button>
        }
      />

      <form role="search" aria-label={t("filters.label")} onSubmit={(e) => e.preventDefault()} className="rounded-xl border bg-card p-2.5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect id="f" value={filters} range={[from, to]} today={today} onChange={(next) => {
            const query = serialize(next);
            if (query.toString() !== searchParams.toString()) setSearchParams(query);
          }} />
        </div>
      </form>

      {report.status === "error" && !sessionExpired && (
        <ErrorState
          message={report.error instanceof ApiError && report.error.status === 403 ? t("errors.forbidden") : report.error instanceof ApiError ? report.error.message : t("errors.network")}
          onRetry={retry}
        />
      )}

      {!data && report.status === "loading" && <DashboardSkeleton />}

      {data && now && (
        <main className={`space-y-6 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <MetricCard title={t("finance.turnover")} hint={t("finance.turnoverHint")} metric={compared("revenue")} polarity="up_is_good" format={money} spark={spark((d) => d.revenue)} />
            <MetricCard title={t("finance.commission")} hint={t("finance.commissionHint")} metric={compared("commission")} polarity="up_is_good" format={money} />
            <MetricCard title={t("finance.payout")} hint={t("finance.payoutHint")} metric={compared("payout")} polarity="up_is_good" format={money} />
            <MetricCard title={t("finance.averageCheck")} hint={t("finance.averageCheckHint")} metric={compared("average")} polarity="up_is_good" format={money} />
            <MetricCard title={t("finance.jobs")} metric={compared("jobs")} polarity="up_is_good" spark={spark((d) => d.jobs)} />
            <MetricCard title={t("finance.workers")} hint={t("finance.workersHint")} metric={compared("workers")} polarity="up_is_good" spark={spark((d) => d.workers)} />
          </div>

          <SectionCard title={t("finance.daily.title")} description={t("finance.daily.description")}>
            {data.totals.jobs ? (
              <>
                <TurnoverChart days={data.days} previous={prev?.days} />
                <Legend />
              </>
            ) : (
              <EmptyState hint={t("jobs.emptyHint")}>{t("finance.empty")}</EmptyState>
            )}
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard className="xl:col-span-2" title={t("finance.workersTop.title")} description={t("finance.workersTop.description")}>
              <PeopleByMoney rows={data.workers} total={data.totals.revenue} caption={t("finance.workersTop.title")} />
            </SectionCard>
            <SectionCard
              title={t("finance.categories.title")}
              description={
                data.totals.jobs > data.jobs.length
                  ? t("finance.categories.partial", { limit: formatNumber(data.limits.jobs), total: formatNumber(data.totals.jobs) })
                  : t("finance.categories.description")
              }
            >
              <CategoryTurnover report={data} />
            </SectionCard>
          </div>

          <SectionCard title={t("finance.clientsTop.title")} description={t("finance.clientsTop.description")}>
            <PeopleByMoney rows={data.clients} total={data.totals.revenue} caption={t("finance.clientsTop.title")} />
          </SectionCard>
        </main>
      )}
    </AppShell>
  );
}
