import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { SectionCard } from "../components/layout/Page";
import { DataTable, type Column } from "../components/stats/DataTable";
import { MetricCard } from "../components/stats/MetricCard";
import { BarList, FunnelBars, KpiGrid, Person, StatList, UnavailableNote } from "../components/stats/ReportBlocks";
import { ReportLayout, useReportPage } from "../components/stats/ReportLayout";
import { SeriesLineChart } from "../components/stats/SeriesLineChart";
import { apiUrl } from "../lib/api";
import { formatDuration, formatMoney, formatNumber, formatPercent } from "../lib/format";
import { MARKETS, REPORT_PATHS, type MarketName, type MarketplaceReport } from "../lib/reports";

const money = (value: number | null) => formatMoney(value, "UZS", true);
const moneyAxis = (value: number) => formatMoney(value, "UZS", true).replace(/\s\S+$/, "");
const percent = (value: number | null) => formatPercent(value);
const duration = (value: number | null) => formatDuration(value);

function Products({ rows }: { rows: MarketplaceReport["top_products"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "rank", header: "#", cell: (r) => <span className="text-muted-foreground tabular-nums">{rows.indexOf(r) + 1}</span>, sort: (r) => rows.indexOf(r) },
    {
      key: "product",
      header: t("marketplace.products.product"),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          {r.image ? (
            <img src={apiUrl(r.image)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md border object-cover" />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-md border bg-muted" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title ?? `#${r.listing_id}`}</p>
            <p className="truncate text-xs text-muted-foreground">{r.seller ?? `#${r.seller_id}`}</p>
          </div>
        </div>
      ),
      sort: (r) => (r.title ?? "").toLowerCase(),
    },
    { key: "units", header: t("marketplace.products.units"), numeric: true, cell: (r) => formatNumber(r.units), sort: (r) => r.units },
    { key: "orders", header: t("marketplace.products.orders"), numeric: true, cell: (r) => formatNumber(r.orders), sort: (r) => r.orders, className: "hidden sm:table-cell" },
    { key: "revenue", header: t("marketplace.products.revenue"), numeric: true, cell: (r) => money(r.revenue), sort: (r) => r.revenue },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("marketplace.products.title")} rowKey={(r) => r.listing_id} />;
}

function Sellers({ rows }: { rows: MarketplaceReport["top_sellers"] }) {
  const { t } = useTranslation();
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "rank", header: "#", cell: (r) => <span className="text-muted-foreground tabular-nums">{rows.indexOf(r) + 1}</span>, sort: (r) => rows.indexOf(r) },
    { key: "seller", header: t("marketplace.sellers.seller"), cell: (r) => <Person id={r.seller_id} name={r.name} phone={r.phone} />, sort: (r) => (r.name ?? "").toLowerCase() },
    { key: "orders", header: t("marketplace.sellers.orders"), numeric: true, cell: (r) => formatNumber(r.orders), sort: (r) => r.orders },
    { key: "buyers", header: t("marketplace.sellers.buyers"), numeric: true, cell: (r) => formatNumber(r.buyers), sort: (r) => r.buyers, className: "hidden sm:table-cell" },
    { key: "sales", header: t("marketplace.sellers.sales"), numeric: true, cell: (r) => money(r.sales), sort: (r) => r.sales },
    { key: "cancelled", header: t("marketplace.sellers.cancelled"), numeric: true, cell: (r) => formatNumber(r.cancelled_by_seller), sort: (r) => r.cancelled_by_seller, className: "hidden md:table-cell" },
  ];
  return <DataTable columns={columns} rows={rows} caption={t("marketplace.sellers.title")} rowKey={(r) => r.seller_id} />;
}

function Content({ data }: { data: MarketplaceReport }) {
  const { t } = useTranslation();
  const s = data.summary;
  const spark = (key: keyof MarketplaceReport["series"][number]) => data.series.map((p) => p[key] as number);
  const status = (key: string) => t(`marketplace.statuses.${key}`, { defaultValue: key });
  const food = data.meta.market === "food";
  return (
    <>
      <SectionCard title={t("marketplace.stock.title")} description={t("marketplace.stock.description")}>
        <StatList
          items={[
            { label: t("marketplace.stock.activeProducts"), value: `${formatNumber(data.stock.active_products)} / ${formatNumber(data.stock.products)}` },
            { label: t("marketplace.stock.activeSellers"), value: formatNumber(data.stock.active_sellers) },
            ...Object.entries(data.stock.open_orders).map(([key, n]) => ({ label: status(key), value: formatNumber(n) })),
            { label: t("marketplace.stock.review"), value: formatNumber(data.stock.needs_admin_review) },
            ...(food
              ? [
                  { label: t("marketplace.stock.trips"), value: formatNumber(data.stock.active_delivery_trips ?? null) },
                  { label: t("marketplace.stock.couriers"), value: formatNumber(data.stock.active_couriers ?? null) },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <KpiGrid>
        <MetricCard title={t("marketplace.kpi.gmv")} hint={t("marketplace.kpi.gmvHint")} metric={s.gmv} polarity="up_is_good" format={money} spark={spark("gmv")} />
        <MetricCard title={t("marketplace.kpi.placed")} metric={s.placed} polarity="up_is_good" spark={spark("placed")} />
        <MetricCard title={t("marketplace.kpi.completed")} metric={s.completed} polarity="up_is_good" spark={spark("completed")} />
        <MetricCard title={t("marketplace.kpi.aov")} hint={t("marketplace.kpi.aovHint")} metric={s.average_order_value} polarity="up_is_good" format={money} />
        <MetricCard title={t("marketplace.kpi.cancellationRate")} hint={t("marketplace.kpi.cancellationRateHint")} metric={s.cancellation_rate} polarity="up_is_bad" format={percent} />
        <MetricCard title={t("marketplace.kpi.repeat")} hint={t("marketplace.kpi.repeatHint")} metric={s.repeat_customer_rate} polarity="up_is_good" format={percent} />
        <MetricCard title={t("marketplace.kpi.buyers")} metric={s.buyers} polarity="up_is_good" />
        <MetricCard title={t("marketplace.kpi.newSellers")} hint={t("marketplace.kpi.newSellersHint")} metric={s.new_sellers} polarity="up_is_good" />
      </KpiGrid>
      <KpiGrid cols={3}>
        <MetricCard compact title={t("marketplace.kpi.fulfilment")} hint={t("marketplace.kpi.fulfilmentHint")} metric={s.fulfilment_seconds} polarity="up_is_bad" format={duration} />
        <MetricCard compact title={t("marketplace.kpi.delivery")} hint={t("marketplace.kpi.deliveryHint")} metric={s.delivery_seconds} polarity="up_is_bad" format={duration} />
        <MetricCard compact title={t("marketplace.kpi.placedValue")} hint={t("marketplace.kpi.placedValueHint")} metric={s.placed_value} polarity="up_is_good" format={money} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("marketplace.gmvTrend.title")} description={t("marketplace.gmvTrend.description")}>
          <SeriesLineChart data={data.series} granularity={data.meta.granularity} format={money} axisFormat={moneyAxis}
            items={[{ key: "gmv", label: t("marketplace.kpi.gmv"), color: "var(--series-7)" }]} />
        </SectionCard>
        <SectionCard title={t("marketplace.funnel.title")} description={t("marketplace.funnel.description")}>
          <FunnelBars stages={data.funnel.stages} label={(stage) => t(`marketplace.funnel.stages.${stage}`, { defaultValue: stage })} />
          <div className="mt-5 border-t pt-4">
            <StatList
              items={[
                { label: t("marketplace.funnel.abandoned"), value: formatNumber(data.funnel.abandoned_carts) },
                { label: t("marketplace.funnel.abandonmentRate"), value: formatPercent(data.funnel.cart_abandonment_rate) },
              ]}
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title={t("marketplace.ordersTrend.title")}>
          <SeriesLineChart
            data={data.series}
            granularity={data.meta.granularity}
            items={[
              { key: "placed", label: t("marketplace.kpi.placed"), color: "var(--series-1)" },
              { key: "completed", label: t("marketplace.kpi.completed"), color: "var(--series-3)" },
              { key: "cancelled", label: t("marketplace.kpi.cancelled"), color: "var(--series-8)" },
            ]}
          />
        </SectionCard>
        <SectionCard title={t("marketplace.cohort.title")} description={t("marketplace.cohort.description")}>
          <BarList rows={data.cohort.filter((c) => c.orders).map((c) => ({ key: c.status, label: status(c.status), value: c.orders, note: formatPercent(c.share_percent) }))} />
        </SectionCard>
      </div>

      <SectionCard
        title={t("marketplace.cancellations.title")}
        description={t("marketplace.cancellations.description", {
          value: money(data.cancellations.value),
          count: data.cancellations.after_delivery_started,
        })}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <BarList color="var(--series-8)" rows={data.cancellations.by_side.map((r) => ({ key: r.side, label: t(`marketplace.sides.${r.side}`, { defaultValue: r.side }), value: r.orders, note: formatPercent(r.share_percent) }))} />
          <BarList color="var(--series-other)" empty={t("marketplace.cancellations.noReasons")} rows={data.cancellations.reasons.map((r) => ({ key: r.reason, label: r.reason, value: r.orders }))} />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("marketplace.products.title")}>
          <Products rows={data.top_products} />
        </SectionCard>
        <SectionCard title={t("marketplace.sellers.title")}>
          <Sellers rows={data.top_sellers} />
        </SectionCard>
      </div>

      <UnavailableNote items={data.meta.unavailable} />
    </>
  );
}

export function MarketplacePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const market: MarketName = searchParams.get("market") === "food" ? "food" : "marketplace";
  const state = useReportPage<MarketplaceReport>(REPORT_PATHS.marketplace, market === "food" ? { market } : {});
  const switcher = (
    <div role="group" aria-label={t("marketplace.market")} className="inline-flex h-9 rounded-lg border bg-muted/50 p-0.5">
      {MARKETS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={market === m}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (m === "food") next.set("market", m);
            else next.delete("market");
            setSearchParams(next);
          }}
          className={`rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            market === m ? "bg-background font-medium text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`marketplace.markets.${m}`)}
        </button>
      ))}
    </div>
  );
  return (
    <ReportLayout title={t("marketplace.title")} description={t("marketplace.description")} page="/marketplace" state={state} controls={switcher}>
      {(data) => <Content data={data} />}
    </ReportLayout>
  );
}
