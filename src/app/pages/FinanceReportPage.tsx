import { useTranslation } from "react-i18next";
import { SectionCard } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { MetricCard } from "../components/stats/MetricCard";
import { BarList, KpiGrid, Person, StatList } from "../components/stats/ReportBlocks";
import { ReportLayout, useReportPage } from "../components/stats/ReportLayout";
import { SeriesLineChart } from "../components/stats/SeriesLineChart";
import { formatDateTime } from "../lib/dates";
import { formatDuration, formatMoney, formatNumber, formatPercent } from "../lib/format";
import { REPORT_PATHS, type FinanceReport } from "../lib/reports";

const money = (value: number | null) => formatMoney(value, "UZS", true);
const moneyAxis = (value: number) => formatMoney(value, "UZS", true).replace(/\s\S+$/, "");
const percent = (value: number | null) => formatPercent(value);

function Providers({ rows }: { rows: FinanceReport["breakdowns"]["provider"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "provider", header: t("financeReport.providers.provider"), cell: (r) => <span className="font-medium">{t(`financeReport.providerNames.${r.provider}`, { defaultValue: r.provider })}</span>, sort: (r) => r.provider },
    { key: "succeeded", header: t("financeReport.providers.succeeded"), numeric: true, cell: (r) => formatNumber(r.succeeded), sort: (r) => r.succeeded },
    { key: "amount", header: t("financeReport.providers.amount"), numeric: true, cell: (r) => money(r.amount), sort: (r) => r.amount },
    { key: "failed", header: t("financeReport.providers.failed"), numeric: true, cell: (r) => formatNumber(r.failed), sort: (r) => r.failed },
    { key: "cancelled", header: t("financeReport.providers.cancelled"), numeric: true, cell: (r) => formatNumber(r.cancelled), sort: (r) => r.cancelled, className: "hidden md:table-cell" },
    { key: "pending", header: t("financeReport.providers.pending"), numeric: true, cell: (r) => formatNumber(r.pending), sort: (r) => r.pending, className: "hidden md:table-cell" },
    { key: "rate", header: t("financeReport.providers.successRate"), numeric: true, cell: (r) => formatPercent(r.success_rate), sort: (r) => r.success_rate },
    { key: "time", header: t("financeReport.providers.processing"), numeric: true, cell: (r) => formatDuration(r.average_processing_seconds), sort: (r) => r.average_processing_seconds, className: "hidden lg:table-cell" },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("financeReport.providers.title")} rowKey={(r) => r.provider} />;
}

function Leaders({ rows }: { rows: FinanceReport["leaders"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "rank", header: "#", cell: (r) => <span className="text-muted-foreground tabular-nums">{rows.indexOf(r) + 1}</span>, sort: (r) => rows.indexOf(r) },
    {
      key: "who",
      header: t("financeReport.leaders.account"),
      cell: (r) => (
        <div className="min-w-0">
          <Person id={r.user_id} name={r.company ?? r.name} phone={r.phone} />
          {r.company && r.name && <p className="truncate text-xs text-muted-foreground">{r.name}</p>}
        </div>
      ),
      sort: (r) => (r.company ?? r.name ?? "").toLowerCase(),
    },
    { key: "type", header: t("financeReport.leaders.type"), cell: (r) => t(`financeReport.accountTypes.${r.account_type}`), sort: (r) => r.account_type, className: "hidden sm:table-cell" },
    { key: "spent", header: t("financeReport.leaders.spent"), numeric: true, cell: (r) => money(r.spent), sort: (r) => r.spent },
    { key: "tx", header: t("financeReport.leaders.transactions"), numeric: true, cell: (r) => formatNumber(r.transactions), sort: (r) => r.transactions, className: "hidden md:table-cell" },
    { key: "commission", header: t("financeReport.leaders.commission"), numeric: true, cell: (r) => money(r.commission), sort: (r) => r.commission, className: "hidden md:table-cell" },
    { key: "last", header: t("financeReport.leaders.last"), cell: (r) => (r.last_transaction_at ? formatDateTime(r.last_transaction_at) : "—"), sort: (r) => r.last_transaction_at, className: "hidden lg:table-cell" },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("financeReport.leaders.title")} rowKey={(r) => r.user_id} />;
}

function Content({ data }: { data: FinanceReport }) {
  const { t } = useTranslation();
  const s = data.summary;
  const spark = (key: keyof FinanceReport["series"][number]) => data.series.map((p) => p[key] as number);
  const g = data.meta.granularity;
  return (
    <>
      <KpiGrid>
        <MetricCard title={t("financeReport.kpi.revenue")} hint={t("financeReport.kpi.revenueHint")} metric={s.revenue} polarity="up_is_good" format={money} spark={spark("revenue")} />
        <MetricCard title={t("financeReport.kpi.netRevenue")} hint={t("financeReport.kpi.netRevenueHint")} metric={s.net_revenue} polarity="up_is_good" format={money} />
        <MetricCard title={t("financeReport.kpi.commission")} hint={t("financeReport.kpi.commissionHint")} metric={s.commission} polarity="up_is_good" format={money} spark={spark("commission")} />
        <MetricCard title={t("financeReport.kpi.refunds")} metric={s.refunds} polarity="up_is_bad" format={money} spark={spark("refunds")} />
        <MetricCard title={t("financeReport.kpi.topUps")} hint={t("financeReport.kpi.topUpsHint")} metric={s.top_ups} polarity="up_is_good" format={money} spark={spark("top_ups")} />
        <MetricCard title={t("financeReport.kpi.averageTopUp")} metric={s.average_top_up} polarity="neutral" format={money} footnote={t("financeReport.kpi.topUpCount", { count: s.top_up_count.value ?? 0 })} />
        <MetricCard title={t("financeReport.kpi.failedPayments")} metric={s.failed_payments} polarity="up_is_bad" spark={spark("failed_payments")} />
        <MetricCard title={t("financeReport.kpi.payingUsers")} hint={t("financeReport.kpi.payingUsersHint")} metric={s.paying_users} polarity="up_is_good" />
      </KpiGrid>
      <KpiGrid>
        <MetricCard compact title={t("financeReport.kpi.arpu")} hint={t("financeReport.kpi.arpuHint")} metric={s.arpu} polarity="up_is_good" format={money} />
        <MetricCard compact title={t("financeReport.kpi.arppu")} hint={t("financeReport.kpi.arppuHint")} metric={s.arppu} polarity="up_is_good" format={money} />
        <MetricCard compact title={t("financeReport.kpi.payingShare")} hint={t("financeReport.kpi.payingShareHint")} metric={s.paying_share} polarity="up_is_good" format={percent} />
        <MetricCard compact title={t("financeReport.kpi.activeUsers")} metric={s.active_users} polarity="up_is_good" />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("financeReport.trend.title")} description={t("financeReport.trend.description")}>
          <SeriesLineChart
            data={data.series}
            granularity={g}
            format={money}
            axisFormat={moneyAxis}
            items={[
              { key: "revenue", label: t("financeReport.kpi.revenue"), color: "var(--series-1)" },
              { key: "top_ups", label: t("financeReport.kpi.topUps"), color: "var(--series-3)" },
              { key: "refunds", label: t("financeReport.kpi.refunds"), color: "var(--series-8)" },
            ]}
          />
        </SectionCard>
        <SectionCard title={t("financeReport.modules.title")} description={t("financeReport.modules.description")}>
          <BarList
            format={(v) => money(v)}
            rows={data.breakdowns.module.map((m) => ({
              key: m.module,
              label: t(`financeReport.moduleNames.${m.module}`, { defaultValue: m.module }),
              value: m.revenue.value ?? 0,
              note: m.monetized ? (m.share_percent !== null ? formatPercent(m.share_percent) : undefined) : t("financeReport.modules.notMonetized"),
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard title={t("financeReport.providers.title")} description={t("financeReport.providers.description")}>
        <Providers rows={data.breakdowns.provider} />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("financeReport.leaders.title")} description={t("financeReport.leaders.description")}>
          <Leaders rows={data.leaders} />
        </SectionCard>
        <SectionCard title={t("financeReport.wallets.title")} description={t("financeReport.wallets.description")}>
          <StatList
            items={[
              { label: t("financeReport.wallets.total"), value: money(data.wallets.total_balance) },
              { label: t("financeReport.wallets.wallets"), value: formatNumber(data.wallets.wallets) },
              { label: t("financeReport.wallets.funded"), value: formatNumber(data.wallets.funded_wallets) },
              { label: t("financeReport.wallets.negative"), value: formatNumber(data.wallets.negative_wallets) },
              { label: t("financeReport.wallets.adjustments"), value: formatNumber(data.wallets.adjustments.count) },
              { label: t("financeReport.wallets.adminTopUps"), value: money(s.admin_top_ups.value) },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}

export function FinanceReportPage() {
  const { t } = useTranslation();
  const state = useReportPage<FinanceReport>(REPORT_PATHS.finance);
  return (
    <ReportLayout title={t("financeReport.title")} description={t("financeReport.description")} page="/finance" state={state} forbidden={t("financeReport.forbidden")}>
      {(data) => <Content data={data} />}
    </ReportLayout>
  );
}
