import { useTranslation } from "react-i18next";
import { SectionCard } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { MetricCard } from "../components/stats/MetricCard";
import { BarList, KpiGrid, Person, StatList, UnavailableNote } from "../components/stats/ReportBlocks";
import { ReportLayout, useReportPage } from "../components/stats/ReportLayout";
import { SeriesLineChart } from "../components/stats/SeriesLineChart";
import { formatDuration, formatFixed, formatMoney, formatNumber, formatPercent } from "../lib/format";
import { REPORT_PATHS, type DailyWorksReport } from "../lib/reports";

const money = (value: number | null) => formatMoney(value, "UZS", true);
const moneyAxis = (value: number) => formatMoney(value, "UZS", true).replace(/\s\S+$/, "");
const duration = (value: number | null) => formatDuration(value);
const percent = (value: number | null) => formatPercent(value);
const rating = (value: number | null) => formatFixed(value, 2);

function Categories({ rows }: { rows: DailyWorksReport["categories"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "category", header: t("dailyWorks.categories.category"), cell: (r) => <span className="font-medium">{r.category ?? `#${r.category_id}`}</span>, sort: (r) => (r.category ?? "").toLowerCase() },
    { key: "jobs", header: t("dailyWorks.categories.jobs"), numeric: true, cell: (r) => formatNumber(r.jobs), sort: (r) => r.jobs },
    { key: "completed", header: t("dailyWorks.categories.completed"), numeric: true, cell: (r) => formatNumber(r.completed), sort: (r) => r.completed, className: "hidden sm:table-cell" },
    { key: "unassigned", header: t("dailyWorks.categories.unassigned"), numeric: true, cell: (r) => formatNumber(r.unassigned), sort: (r) => r.unassigned },
    { key: "price", header: t("dailyWorks.categories.averagePrice"), numeric: true, cell: (r) => money(r.average_price), sort: (r) => r.average_price, className: "hidden md:table-cell" },
    { key: "workers", header: t("dailyWorks.categories.workers"), numeric: true, cell: (r) => `${formatNumber(r.workers)} / ${formatNumber(r.workers_online)}`, sort: (r) => r.workers },
    {
      key: "ratio",
      header: t("dailyWorks.categories.jobsPerWorker"),
      numeric: true,
      cell: (r) =>
        r.jobs_per_worker === null ? (
          r.jobs ? <span className="font-medium text-[color:var(--delta-bad)]">{t("dailyWorks.categories.noWorkers")}</span> : "—"
        ) : (
          formatNumber(r.jobs_per_worker)
        ),
      sort: (r) => r.jobs_per_worker ?? (r.jobs ? Number.MAX_SAFE_INTEGER : null),
    },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("dailyWorks.categories.title")} pageSize={10} rowKey={(r) => r.category_id} />;
}

function TopRated({ rows, min }: { rows: DailyWorksReport["top_rated_workers"]; min: number }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "rank", header: "#", cell: (r) => <span className="text-muted-foreground tabular-nums">{rows.indexOf(r) + 1}</span>, sort: (r) => rows.indexOf(r) },
    { key: "who", header: t("dailyWorks.topRated.worker"), cell: (r) => <Person id={r.user_id} name={r.name} phone={r.phone} />, sort: (r) => (r.name ?? "").toLowerCase() },
    { key: "rating", header: t("dailyWorks.topRated.rating"), numeric: true, cell: (r) => rating(r.rating), sort: (r) => r.rating },
    { key: "ratings", header: t("dailyWorks.topRated.ratings"), numeric: true, cell: (r) => formatNumber(r.ratings), sort: (r) => r.ratings, className: "hidden sm:table-cell" },
    { key: "jobs", header: t("dailyWorks.topRated.jobs"), numeric: true, cell: (r) => formatNumber(r.completed_jobs), sort: (r) => r.completed_jobs },
  ];
  return (
    <>
      <p className="-mt-3 mb-3 text-xs text-muted-foreground">{t("dailyWorks.topRated.min", { count: min })}</p>
      <DataTable columns={columns} rows={rows} caption={t("dailyWorks.topRated.title")} rowKey={(r) => r.user_id} />
    </>
  );
}

function Content({ data }: { data: DailyWorksReport }) {
  const { t } = useTranslation();
  const s = data.summary;
  const spark = (key: keyof DailyWorksReport["series"][number]) => data.series.map((p) => p[key] as number);
  const g = data.meta.granularity;
  const side = (key: string) => t(`dailyWorks.sides.${key}`, { defaultValue: key });
  return (
    <>
      <SectionCard title={t("dailyWorks.now.title")} description={t("dailyWorks.now.description")}>
        <StatList
          items={[
            { label: t("dailyWorks.now.workersOnline"), value: formatNumber(data.now.workers_online) },
            { label: t("dailyWorks.now.workersOnJob"), value: formatNumber(data.now.workers_on_job) },
            { label: t("dailyWorks.now.openJobs"), value: formatNumber(data.now.open_jobs) },
            { label: t("dailyWorks.now.searching"), value: formatNumber(data.now.searching) },
            { label: t("dailyWorks.now.inProgress"), value: formatNumber(data.now.in_progress) },
            { label: t("dailyWorks.now.verified"), value: `${formatNumber(data.now.workers_verified)} / ${formatNumber(data.now.workers_total)}` },
          ]}
        />
      </SectionCard>

      <KpiGrid>
        <MetricCard title={t("dailyWorks.kpi.published")} metric={s.published} polarity="up_is_good" spark={spark("published")} />
        <MetricCard title={t("dailyWorks.kpi.completed")} metric={s.completed} polarity="up_is_good" spark={spark("completed")} />
        <MetricCard title={t("dailyWorks.kpi.completionRate")} hint={t("dailyWorks.kpi.completionRateHint")} metric={s.completion_rate} polarity="up_is_good" format={percent} />
        <MetricCard title={t("dailyWorks.kpi.cancelled")} metric={s.cancelled} polarity="up_is_bad" spark={spark("cancelled")} />
        <MetricCard title={t("dailyWorks.kpi.volume")} hint={t("dailyWorks.kpi.volumeHint")} metric={s.volume} polarity="up_is_good" format={money} spark={spark("volume")} />
        <MetricCard title={t("dailyWorks.kpi.commission")} metric={s.commission} polarity="up_is_good" format={money} spark={spark("commission")} />
        <MetricCard title={t("dailyWorks.kpi.earnings")} hint={t("dailyWorks.kpi.earningsHint")} metric={s.worker_earnings} polarity="up_is_good" format={money} />
        <MetricCard title={t("dailyWorks.kpi.averagePrice")} metric={s.average_price} polarity="neutral" format={money} />
      </KpiGrid>
      <KpiGrid>
        <MetricCard compact title={t("dailyWorks.kpi.assignment")} hint={t("dailyWorks.kpi.assignmentHint")} metric={s.assignment_seconds} polarity="up_is_bad" format={duration} />
        <MetricCard compact title={t("dailyWorks.kpi.duration")} hint={t("dailyWorks.kpi.durationHint")} metric={s.duration_seconds} polarity="neutral" format={duration} />
        <MetricCard compact title={t("dailyWorks.kpi.unassigned")} hint={t("dailyWorks.kpi.unassignedHint")} metric={s.unassigned} polarity="up_is_bad" />
        <MetricCard compact title={t("dailyWorks.kpi.rating")} metric={s.average_rating} polarity="up_is_good" format={rating} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("dailyWorks.trend.title")} description={t("dailyWorks.trend.description")}>
          <SeriesLineChart
            data={data.series}
            granularity={g}
            items={[
              { key: "published", label: t("dailyWorks.kpi.published"), color: "var(--series-1)" },
              { key: "completed", label: t("dailyWorks.kpi.completed"), color: "var(--series-3)" },
              { key: "cancelled", label: t("dailyWorks.kpi.cancelled"), color: "var(--series-8)" },
            ]}
          />
        </SectionCard>
        <SectionCard title={t("dailyWorks.cohort.title")} description={t("dailyWorks.cohort.description")}>
          <BarList
            rows={data.cohort.filter((c) => c.jobs).map((c) => ({
              key: c.status,
              label: t(`dailyWorks.statuses.${c.status}`, { defaultValue: c.status }),
              value: c.jobs,
              note: formatPercent(c.share_percent),
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard title={t("dailyWorks.money.title")} description={t("dailyWorks.money.description")}>
        <SeriesLineChart
          data={data.series}
          granularity={g}
          format={money}
          axisFormat={moneyAxis}
          items={[
            { key: "volume", label: t("dailyWorks.kpi.volume"), color: "var(--series-7)" },
            { key: "commission", label: t("dailyWorks.kpi.commission"), color: "var(--series-4)" },
          ]}
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("dailyWorks.cancellations.title")} description={t("dailyWorks.cancellations.description", { value: money(s.cancelled_value.value) })}>
          <SeriesLineChart
            data={data.cancellations.series}
            granularity={g}
            items={["client", "worker", "system", "other"].map((k, i) => ({ key: k, label: side(k), color: `var(--series-${[2, 5, 6, 8][i]})` }))}
          />
        </SectionCard>
        <SectionCard title={t("dailyWorks.cancellations.bySide")}>
          <BarList
            color="var(--series-8)"
            rows={data.cancellations.by_side.map((r) => ({
              key: r.side,
              label: side(r.side),
              value: r.jobs,
              note: r.after_assignment ? t("dailyWorks.cancellations.afterAssignment", { count: r.after_assignment }) : undefined,
            }))}
          />
          {data.cancellations.reasons.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-sm font-medium">{t("dailyWorks.cancellations.reasons")}</h3>
              <BarList color="var(--series-other)" rows={data.cancellations.reasons.map((r) => ({ key: r.reason, label: r.reason, value: r.jobs }))} />
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t("dailyWorks.categories.title")} description={t("dailyWorks.categories.description")}>
        <Categories rows={data.categories} />
      </SectionCard>

      <SectionCard title={t("dailyWorks.topRated.title")}>
        <TopRated rows={data.top_rated_workers} min={data.meta.min_ratings} />
      </SectionCard>

      <UnavailableNote items={data.meta.unavailable} />
    </>
  );
}

export function DailyWorksPage() {
  const { t } = useTranslation();
  const state = useReportPage<DailyWorksReport>(REPORT_PATHS.dailyWorks);
  return (
    <ReportLayout title={t("dailyWorks.title")} description={t("dailyWorks.description")} page="/daily-works" state={state}>
      {(data) => <Content data={data} />}
    </ReportLayout>
  );
}
