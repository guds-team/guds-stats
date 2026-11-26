import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { MetricCard } from "../components/stats/MetricCard";
import { BarList, FunnelBars, KpiGrid, StatList, UnavailableNote } from "../components/stats/ReportBlocks";
import { ReportLayout, useReportPage } from "../components/stats/ReportLayout";
import { SeriesLineChart } from "../components/stats/SeriesLineChart";
import { formatDuration, formatMoney, formatNumber, formatPercent } from "../lib/format";
import { REPORT_PATHS, type EmploymentReport } from "../lib/reports";

function Companies({ rows }: { rows: EmploymentReport["companies"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "rank", header: "#", cell: (r) => <span className="text-muted-foreground tabular-nums">{rows.indexOf(r) + 1}</span>, sort: (r) => rows.indexOf(r) },
    {
      key: "name",
      header: t("employment.companies.company"),
      cell: (r) => (
        <span className="font-medium">
          {r.name}
          {r.verified && <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{t("employment.companies.verified")}</span>}
        </span>
      ),
      sort: (r) => r.name.toLowerCase(),
    },
    { key: "active", header: t("employment.companies.activeVacancies"), numeric: true, cell: (r) => formatNumber(r.active_vacancies), sort: (r) => r.active_vacancies, className: "hidden sm:table-cell" },
    { key: "apps", header: t("employment.companies.applications"), numeric: true, cell: (r) => formatNumber(r.applications), sort: (r) => r.applications },
    { key: "hires", header: t("employment.companies.hires"), numeric: true, cell: (r) => formatNumber(r.hires), sort: (r) => r.hires },
    { key: "unanswered", header: t("employment.companies.unanswered"), numeric: true, cell: (r) => formatNumber(r.unanswered), sort: (r) => r.unanswered, className: "hidden md:table-cell" },
    { key: "response", header: t("employment.companies.responseTime"), numeric: true, cell: (r) => formatDuration(r.average_response_seconds), sort: (r) => r.average_response_seconds, className: "hidden md:table-cell" },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("employment.companies.title")} rowKey={(r) => r.company_id} />;
}

function Salaries({ data }: { data: EmploymentReport["salaries"] }) {
  const { t } = useTranslation();
  const [by, setBy] = useState<"by_specialization" | "by_region">("by_specialization");
  const rows = data[by];
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "name", header: t(`employment.salaries.${by}`), cell: (r) => r.name ?? t("employment.salaries.unknown"), sort: (r) => (r.name ?? "").toLowerCase() },
    { key: "vacancies", header: t("employment.salaries.vacancies"), numeric: true, cell: (r) => formatNumber(r.vacancies), sort: (r) => r.vacancies },
    { key: "average", header: t("employment.salaries.average"), numeric: true, cell: (r) => formatMoney(r.average, r.currency, true), sort: (r) => r.average },
  ];
  return (
    <>
      <div role="group" className="mb-4 inline-flex h-8 rounded-lg border bg-muted/50 p-0.5">
        {(["by_specialization", "by_region"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={by === key}
            onClick={() => setBy(key)}
            className={`rounded-md px-3 text-xs ${by === key ? "bg-background font-medium shadow-card" : "text-muted-foreground"}`}
          >
            {t(`employment.salaries.${key}`)}
          </button>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} caption={t("employment.salaries.title")} pageSize={10} rowKey={(r) => `${r.name}-${r.currency}`} />
    </>
  );
}

function DemandSupply({ rows }: { rows: EmploymentReport["demand_supply"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "name", header: t("employment.demand.specialization"), cell: (r) => r.specialization, sort: (r) => r.specialization.toLowerCase() },
    { key: "vacancies", header: t("employment.demand.vacancies"), numeric: true, cell: (r) => formatNumber(r.vacancies), sort: (r) => r.vacancies },
    { key: "resumes", header: t("employment.demand.resumes"), numeric: true, cell: (r) => formatNumber(r.resumes), sort: (r) => r.resumes },
    {
      key: "ratio",
      header: t("employment.demand.ratio"),
      numeric: true,
      cell: (r) => (
        <span className={r.resumes_per_vacancy !== null && r.resumes_per_vacancy < 1 ? "font-medium text-[color:var(--delta-bad)]" : ""}>
          {formatNumber(r.resumes_per_vacancy)}
        </span>
      ),
      sort: (r) => r.resumes_per_vacancy,
    },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("employment.demand.title")} pageSize={10} rowKey={(r) => r.specialization} />;
}

function Content({ data }: { data: EmploymentReport }) {
  const { t } = useTranslation();
  const s = data.summary;
  const spark = (key: keyof EmploymentReport["series"][number]) => data.series.map((p) => p[key] as number);
  const f = data.funnel;
  return (
    <>
      <SectionCard title={t("employment.stock.title")} description={t("employment.stock.description")}>
        <StatList
          items={[
            { label: t("employment.stock.activeVacancies"), value: formatNumber(data.stock.active_vacancies) },
            { label: t("employment.stock.closedVacancies"), value: formatNumber(data.stock.closed_vacancies) },
            { label: t("employment.stock.vacancies"), value: formatNumber(data.stock.vacancies) },
            { label: t("employment.stock.resumes"), value: formatNumber(data.stock.resumes) },
            { label: t("employment.stock.jobSeekers"), value: formatNumber(data.stock.job_seekers) },
            { label: t("employment.stock.companies"), value: `${formatNumber(data.stock.active_companies)} / ${formatNumber(data.stock.companies)}`, hint: t("employment.stock.companiesHint") },
          ]}
        />
      </SectionCard>

      <KpiGrid cols={3}>
        <MetricCard title={t("employment.kpi.vacancies")} metric={s.vacancies_created} polarity="up_is_good" spark={spark("vacancies_created")} />
        <MetricCard title={t("employment.kpi.applications")} metric={s.applications} polarity="up_is_good" spark={spark("applications")} />
        <MetricCard title={t("employment.kpi.views")} metric={s.vacancy_views} polarity="up_is_good" spark={spark("vacancy_views")} />
        <MetricCard title={t("employment.kpi.resumes")} metric={s.resumes_created} polarity="up_is_good" spark={spark("resumes_created")} />
        <MetricCard title={t("employment.kpi.companies")} metric={s.companies_created} polarity="up_is_good" spark={spark("companies_created")} />
        <MetricCard title={t("employment.kpi.hires")} hint={t("employment.kpi.hiresHint")} metric={s.hires} polarity="up_is_good" />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("employment.trend.title")}>
          <SeriesLineChart
            data={data.series}
            granularity={data.meta.granularity}
            items={[
              { key: "applications", label: t("employment.kpi.applications"), color: "var(--series-1)" },
              { key: "vacancies_created", label: t("employment.kpi.vacancies"), color: "var(--series-3)" },
              { key: "resumes_created", label: t("employment.kpi.resumes"), color: "var(--series-4)" },
            ]}
          />
        </SectionCard>
        <SectionCard title={t("employment.funnel.title")} description={t("employment.funnel.description")}>
          <FunnelBars stages={f.stages} label={(stage) => t(`employment.funnel.stages.${stage}`, { defaultValue: stage })} />
          <div className="mt-5 border-t pt-4">
            <StatList
              items={[
                { label: t("employment.funnel.overall"), value: formatPercent(f.overall_conversion) },
                { label: t("employment.funnel.perVacancy"), value: formatNumber(f.applications_per_vacancy) },
                { label: t("employment.funnel.responseTime"), value: formatDuration(f.average_response_seconds) },
                { label: t("employment.funnel.unanswered"), value: `${formatNumber(f.unanswered_applications)} (${formatPercent(f.unanswered_share)})` },
              ]}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t("employment.companies.title")} description={t("employment.companies.description")}>
        <Companies rows={data.companies} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("employment.salaries.title")} description={t("employment.salaries.description")}>
          <Salaries data={data.salaries} />
        </SectionCard>
        <SectionCard title={t("employment.demand.title")} description={t("employment.demand.description")}>
          <DemandSupply rows={data.demand_supply} />
        </SectionCard>
      </div>

      <SectionCard title={t("employment.skills.title")} description={t("employment.skills.description")}>
        <BarList color="var(--series-3)" rows={data.skills.map((r) => ({ key: r.skill, label: r.skill, value: r.vacancies }))} />
      </SectionCard>

      <UnavailableNote items={data.meta.unavailable} />
    </>
  );
}

export function EmploymentPage() {
  const { t } = useTranslation();
  const state = useReportPage<EmploymentReport>(REPORT_PATHS.employment);
  return (
    <ReportLayout title={t("employment.title")} description={t("employment.description")} page="/employment" state={state}>
      {(data) => <Content data={data} />}
    </ReportLayout>
  );
}
