import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, CalendarDays, Clock3, Filter, RefreshCw, RotateCw, UserCheck, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import { PageHeader, SectionCard, useAnimatedNumber } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { axisProps, gridProps } from "../components/stats/chartParts";
import { DashboardSkeleton, EmptyState, ErrorState } from "../components/stats/states";
import { Button } from "../components/ui/button";
import { ApiError } from "../lib/api";
import { addDays, formatDateTime, formatDay, formatRange, todayInStatsTimezone } from "../lib/dates";
import { MAX_RANGE_DAYS, PRESETS, presetRange, type Preset } from "../lib/filters";
import { formatMoney, formatNumber } from "../lib/format";
import {
  JOB_REPORT_STATUSES,
  jobsApiParams,
  parseJobsFilters,
  serializeJobsFilters,
  useJobsReport,
  type JobsFilters,
  type JobsReport,
  type PersonTotal,
  type ReportJob,
} from "../lib/jobs";
import type { Person } from "../lib/live";
import { presetLabel } from "../lib/metrics";

const controlClass =
  "h-9 rounded-lg border bg-background pr-8 pl-3 text-sm transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

function personName(person: Person): string {
  return person.name ?? `#${person.id}`;
}

function PersonCell({ person }: { person: Person | null }) {
  if (!person) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{personName(person)}</p>
      {person.phone && (
        <a href={`tel:${person.phone}`} className="text-xs text-muted-foreground tabular-nums hover:text-foreground">
          {person.phone}
        </a>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, format = formatNumber, detail }: {
  icon: typeof Users;
  label: string;
  value: number;
  format?: (value: number) => string;
  detail?: string;
}) {
  const shown = useAnimatedNumber(value) ?? value;
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] text-muted-foreground">{label}</p>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden>
          <Icon className="h-3.5 w-3.5 text-[var(--accent-brand)]" />
        </span>
      </div>
      <p className="text-[28px] leading-9 font-semibold tracking-tight tabular-nums">{format(shown)}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function DaysChart({ days }: { days: JobsReport["days"] }) {
  const { t } = useTranslation();
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="day" tickFormatter={(d: string) => formatDay(d)} {...axisProps} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} {...axisProps} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as JobsReport["days"][number];
              return (
                <div className="min-w-40 rounded-lg border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg">
                  <p className="mb-1.5 font-medium">{formatDay(p.day, true)}</p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("jobs.columns.jobs")}</span><span className="font-medium tabular-nums">{formatNumber(p.jobs)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("jobs.columns.workers")}</span><span className="tabular-nums">{formatNumber(p.workers)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("jobs.columns.clients")}</span><span className="tabular-nums">{formatNumber(p.clients)}</span></p>
                  <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t("jobs.columns.revenue")}</span><span className="tabular-nums">{formatMoney(p.revenue, "UZS", true)}</span></p>
                </div>
              );
            }}
          />
          <Bar dataKey="jobs" fill="var(--accent-brand)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeopleTable({ rows, caption, onPick }: { rows: PersonTotal[]; caption: string; onPick: (p: PersonTotal) => void }) {
  const { t } = useTranslation();
  const columns: Column<PersonTotal>[] = [
    { key: "person", header: t("jobs.columns.person"), cell: (p) => <PersonCell person={p} />, sort: (p) => personName(p).toLowerCase() },
    { key: "jobs", header: t("jobs.columns.jobs"), numeric: true, cell: (p) => formatNumber(p.jobs), sort: (p) => p.jobs },
    { key: "revenue", header: t("jobs.columns.revenue"), numeric: true, cell: (p) => formatMoney(p.revenue, "UZS", true), sort: (p) => p.revenue, className: "hidden sm:table-cell" },
    {
      key: "filter",
      header: "",
      cell: (p) => (
        <button
          type="button"
          onClick={() => onPick(p)}
          title={t("jobs.person.filter", { name: personName(p) })}
          aria-label={t("jobs.person.filter", { name: personName(p) })}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
        </button>
      ),
    },
  ];
  if (!rows.length) return <EmptyState />;
  return <DataTable columns={columns} rows={rows} caption={caption} pageSize={10} rowKey={(p) => p.id} />;
}

export function JobsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayInStatsTimezone(), []);
  const filters = useMemo(() => parseJobsFilters(searchParams, today), [searchParams, today]);
  const params = useMemo(() => jobsApiParams(filters, today), [filters, today]);
  const report = useJobsReport(params);

  useEffect(() => {
    const canonical = serializeJobsFilters(filters);
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  const set = useCallback(
    (patch: Partial<JobsFilters>) => {
      const query = serializeJobsFilters({ ...filters, ...patch });
      if (query.toString() !== searchParams.toString()) setSearchParams(query);
    },
    [filters, searchParams, setSearchParams],
  );

  const sessionExpired = report.status === "error" && report.error instanceof ApiError && report.error.status === 401;
  useEffect(() => {
    if (sessionExpired) {
      endSession();
      toast.error(t("auth.sessionExpired"));
      navigate(`/login?next=${encodeURIComponent(`/jobs?${searchParams}`)}`, { replace: true });
    }
  }, [sessionExpired, navigate, searchParams, t]);

  const data = report.status === "error" ? null : report.data;
  const loading = report.status === "loading";

  const choosePeriod = (period: Preset) => {
    if (period === "custom") set({ period, date_from: params.date_from, date_to: params.date_to });
    else set({ period, date_from: "", date_to: "" });
  };
  const setCustom = (field: "date_from" | "date_to", value: string) => {
    if (!value) return;
    let date_from = field === "date_from" ? value : filters.date_from;
    let date_to = field === "date_to" ? value : filters.date_to;
    if (date_from > date_to) {
      if (field === "date_from") date_to = date_from;
      else date_from = date_to;
    }
    set({ date_from, date_to });
  };

  // Names of the people the list is narrowed to (from the rows of the current report).
  const findName = (id: string, rows: PersonTotal[] | undefined) => {
    const person = rows?.find((p) => String(p.id) === id);
    return person ? personName(person) : `#${id}`;
  };

  const jobColumns: Column<ReportJob>[] = [
    { key: "at", header: t("jobs.columns.at"), cell: (j) => (j.at ? formatDateTime(j.at) : "—"), sort: (j) => j.at },
    {
      key: "job",
      header: t("jobs.columns.category"),
      cell: (j) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{j.category}</p>
          <p className="text-xs text-muted-foreground">{j.job_id}</p>
        </div>
      ),
      sort: (j) => j.category,
    },
    { key: "worker", header: t("jobs.columns.worker"), cell: (j) => <PersonCell person={j.worker} />, sort: (j) => (j.worker ? personName(j.worker) : null) },
    { key: "client", header: t("jobs.columns.client"), cell: (j) => <PersonCell person={j.client} />, sort: (j) => (j.client ? personName(j.client) : null) },
    { key: "price", header: t("jobs.columns.price"), numeric: true, cell: (j) => formatMoney(j.price, j.currency), sort: (j) => j.price },
    { key: "address", header: t("jobs.columns.address"), cell: (j) => <span className="block max-w-64 truncate" title={j.address}>{j.address}</span>, className: "hidden xl:table-cell" },
  ];

  const dayColumns: Column<JobsReport["days"][number]>[] = [
    { key: "day", header: t("jobs.columns.day"), cell: (d) => formatDay(d.day, true), sort: (d) => d.day },
    { key: "jobs", header: t("jobs.columns.jobs"), numeric: true, cell: (d) => formatNumber(d.jobs), sort: (d) => d.jobs },
    { key: "workers", header: t("jobs.columns.workers"), numeric: true, cell: (d) => formatNumber(d.workers), sort: (d) => d.workers },
    { key: "clients", header: t("jobs.columns.clients"), numeric: true, cell: (d) => formatNumber(d.clients), sort: (d) => d.clients },
    { key: "revenue", header: t("jobs.columns.revenue"), numeric: true, cell: (d) => formatMoney(d.revenue, "UZS", true), sort: (d) => d.revenue },
  ];

  const days = data ? data.days.length : 1;
  const personChips = [
    filters.worker && { key: "worker" as const, label: t("jobs.person.worker", { name: findName(filters.worker, data?.workers) }) },
    filters.client && { key: "client" as const, label: t("jobs.person.client", { name: findName(filters.client, data?.clients) }) },
  ].filter(Boolean) as { key: "worker" | "client"; label: string }[];

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
        title={t("jobs.title")}
        description={t("jobs.description")}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t("dashboard.periodMeta", { range: formatRange(params.date_from, params.date_to) })}
            </span>
            {data && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {t("dashboard.generatedAt", { time: formatDateTime(data.meta.generated_at) })}
              </span>
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

      <form role="search" aria-label={t("filters.label")} onSubmit={(e) => e.preventDefault()} className="rounded-xl border bg-card p-2.5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex min-w-0 items-center">
            <label htmlFor="j-period" className="sr-only">{t("filters.period")}</label>
            <CalendarDays className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <select id="j-period" className={`${controlClass} max-w-full pl-8 font-medium`} value={filters.period} onChange={(e) => choosePeriod(e.target.value as Preset)}>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {presetLabel(p)}
                  {p !== "custom" ? ` · ${formatRange(...presetRange(p, today))}` : ""}
                </option>
              ))}
            </select>
          </div>
          {filters.period === "custom" && (
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="j-from">{t("filters.dateFrom")}</label>
              <input id="j-from" type="date" className={`${controlClass} pr-2`} value={filters.date_from} min={addDays(filters.date_to || today, -(MAX_RANGE_DAYS - 1))} max={today} onChange={(e) => setCustom("date_from", e.target.value)} />
              <span className="text-muted-foreground" aria-hidden>–</span>
              <label className="sr-only" htmlFor="j-to">{t("filters.dateTo")}</label>
              <input id="j-to" type="date" className={`${controlClass} pr-2`} value={filters.date_to} max={today} onChange={(e) => setCustom("date_to", e.target.value)} />
            </div>
          )}
          <div role="group" aria-label={t("jobs.status.label")} className="flex items-center rounded-lg border bg-background p-0.5">
            {JOB_REPORT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filters.status === s}
                onClick={() => set({ status: s })}
                className={`h-8 rounded-md px-3 text-sm transition-colors ${filters.status === s ? "bg-muted font-medium text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t(`jobs.status.${s}`)}
              </button>
            ))}
          </div>
          {personChips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-xs font-medium">
              {chip.label}
              <button
                type="button"
                onClick={() => set({ [chip.key]: "" })}
                aria-label={t("filters.remove", { label: chip.label })}
                className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      </form>

      {report.status === "error" && !sessionExpired && (
        <ErrorState
          message={report.error instanceof ApiError && report.error.status === 403 ? t("errors.forbidden") : report.error instanceof ApiError ? report.error.message : t("errors.network")}
          onRetry={report.retry}
        />
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        <main className={`space-y-6 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi icon={Briefcase} label={t(`jobs.status.${data.meta.status}`)} value={data.totals.jobs}
              detail={t("jobs.totals.perDay", { value: formatNumber(Math.round((data.totals.jobs / days) * 10) / 10) })} />
            <Kpi icon={UserCheck} label={t("jobs.totals.workers")} value={data.totals.workers} />
            <Kpi icon={Users} label={t("jobs.totals.clients")} value={data.totals.clients} />
            <Kpi icon={Wallet} label={t("jobs.totals.revenue")} value={data.totals.revenue} format={(v) => formatMoney(v, "UZS", true)}
              detail={data.totals.commission ? `${t("jobs.totals.commission")}: ${formatMoney(data.totals.commission, "UZS", true)}` : undefined} />
          </div>

          <SectionCard title={t("jobs.perDay.title")} description={t("jobs.perDay.description")}>
            {data.totals.jobs ? (
              <div className="space-y-4">
                <DaysChart days={data.days} />
                <DataTable columns={dayColumns} rows={[...data.days].reverse()} caption={t("jobs.perDay.title")} pageSize={10} rowKey={(d) => d.day} />
              </div>
            ) : (
              <EmptyState hint={t("jobs.emptyHint")}>{t("jobs.empty")}</EmptyState>
            )}
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title={t("jobs.workers.title")} description={t("jobs.workers.description")}>
              <PeopleTable rows={data.workers} caption={t("jobs.workers.title")} onPick={(p) => set({ worker: String(p.id) })} />
            </SectionCard>
            <SectionCard title={t("jobs.clients.title")} description={t("jobs.clients.description")}>
              <PeopleTable rows={data.clients} caption={t("jobs.clients.title")} onPick={(p) => set({ client: String(p.id) })} />
            </SectionCard>
          </div>

          <SectionCard
            title={t("jobs.list.title")}
            description={data.totals.jobs > data.jobs.length ? t("jobs.list.truncated", { limit: formatNumber(data.limits.jobs), total: formatNumber(data.totals.jobs) }) : undefined}
          >
            {data.jobs.length ? (
              <DataTable columns={jobColumns} rows={data.jobs} caption={t("jobs.list.title")} pageSize={20} rowKey={(j) => j.job_id} />
            ) : (
              <EmptyState hint={t("jobs.emptyHint")}>{t("jobs.empty")}</EmptyState>
            )}
          </SectionCard>
        </main>
      )}
    </AppShell>
  );
}
