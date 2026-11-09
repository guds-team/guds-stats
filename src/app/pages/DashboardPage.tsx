import { useCallback, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ArrowRight, CalendarDays, Clock3, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import { PageHeader, SectionCard } from "../components/layout/Page";
import { KpiRow, TopWorkers } from "../components/live/LiveKpis";
import { useLiveStats } from "../lib/live";
import { ExportMenu } from "../components/stats/ExportMenu";
import { Button } from "../components/ui/button";
import { ActivityPanel } from "../components/stats/ActivityPanel";
import { DistributionPanel } from "../components/stats/DistributionPanel";
import { FilterBar } from "../components/stats/FilterBar";
import { FunnelSection } from "../components/stats/FunnelSection";
import { MetricCard } from "../components/stats/MetricCard";
import { ObjectsPanel } from "../components/stats/ObjectsPanel";
import { RegistrationsPanel } from "../components/stats/RegistrationsPanel";
import { DashboardSkeleton, ErrorState } from "../components/stats/states";
import { ApiError } from "../lib/api";
import { formatDateTime, formatRange, todayInStatsTimezone } from "../lib/dates";
import { hasDimensionFilters, parseFilters, serializeFilters, toApiParams, type Filters } from "../lib/filters";
import { countryLabel, granularityLabel, lastBucket, methodLabel, objectLabel, seriesColor } from "../lib/metrics";
import { bucketTitle } from "../components/stats/chartParts";
import { formatNumber, type Polarity } from "../lib/format";
import { useOverview } from "../lib/useOverview";
import type { Compared, Overview } from "../lib/types";

function errorMessage(error: Error, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return t("errors.forbidden");
    if (error.status >= 500) return t("errors.server");
    return error.message; // the API's own message, already in the requested language
  }
  return t("errors.network");
}

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Daily-works and payment outcomes shown as headline cards (when the app filter keeps them). */
const OUTCOMES = [
  { key: "dw_jobs_completed", polarity: "up_is_good" },
  { key: "dw_jobs_cancelled", polarity: "up_is_bad" },
  { key: "payments_succeeded", polarity: "up_is_good" },
  { key: "payments_failed", polarity: "up_is_bad" },
] as const satisfies readonly { key: string; polarity: Polarity }[];

function SummaryCards({ data, today }: { data: Overview; today: string }) {
  const { t } = useTranslation();
  const { users, activity } = data.summary;
  const granularity = data.meta.granularity;
  const daily = granularity === "day";
  const objects = data.summary.objects;
  // "Created objects": only metrics counted at creation; completions, cancellations and payments are separate.
  const created = Object.entries(objects).filter(([, m]) => m.kind === "created");
  const outcomes = OUTCOMES.filter((o) => objects[o.key]);
  const objectSpark = (key: string) => data.series.objects.map((p) => (p[key] as number | undefined) ?? null);

  // Day / week / month: the cards show the last bucket against the one before it,
  // the whole period's figure stays as a footnote. A one-bucket period is the period itself.
  const buckets = data.series.registrations;
  const multi = buckets.length > 1;
  const last = buckets[buckets.length - 1];
  const scope = multi && last ? (last.date_to === today ? t(`dashboard.scope.${granularity}`) : bucketTitle(last)) : undefined;
  const perBucket = (values: (number | null)[], whole: Compared, average = false) => {
    const metric = lastBucket(values, whole);
    if (!multi) return { metric, spark: values };
    return {
      metric,
      spark: values,
      scope,
      previousText: t(`dashboard.previousBucket.${granularity}`, { value: formatNumber(metric.previous) }),
      footnote: t(average ? "dashboard.periodAverage" : "dashboard.periodTotal", { value: formatNumber(whole.value) }),
    };
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="summary-title" className="space-y-3">
        <SectionTitle
          id="summary-title"
          title={t("dashboard.sections.users")}
          hint={multi ? t(`dashboard.sections.usersHintBucket.${granularity}`) : t("dashboard.sections.usersHint")}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <MetricCard
            title={t("dashboard.cards.newRegistrations")}
            polarity="up_is_good"
            hint={t("dashboard.cards.newRegistrationsHint")}
            {...perBucket(
              buckets.map((p) => p.registrations),
              users.new_registrations,
            )}
          />
          <MetricCard
            title={t("dashboard.cards.dau")}
            polarity="up_is_good"
            hint={t("dashboard.cards.dauHint")}
            {...perBucket(
              data.series.activity.map((p) => (daily ? p.dau : p.dau_average) ?? null),
              activity.dau_average,
              true,
            )}
          />
          <MetricCard
            title={t("dashboard.cards.wau")}
            metric={activity.wau}
            polarity="up_is_good"
            hint={t("dashboard.cards.wauHint")}
            spark={daily ? data.series.activity.map((p) => p.wau ?? null) : undefined}
          />
          <MetricCard
            title={t("dashboard.cards.mau")}
            metric={activity.mau}
            polarity="up_is_good"
            hint={t("dashboard.cards.mauHint")}
            spark={daily ? data.series.activity.map((p) => p.mau ?? null) : undefined}
          />
          <MetricCard
            title={t("dashboard.cards.totalUsers")}
            metric={users.total_users}
            polarity="up_is_good"
            hint={t("dashboard.cards.totalUsersHint")}
          />
        </div>
      </section>

      {outcomes.length > 0 && (
        <section aria-labelledby="outcomes-title" className="space-y-3">
          <SectionTitle id="outcomes-title" title={t("dashboard.sections.outcomes")} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {outcomes.map((o) => (
              <MetricCard
                key={o.key}
                title={objectLabel(o.key, objects[o.key].label)}
                polarity={o.polarity}
                hint={t(`dashboard.outcomeHints.${o.key}`)}
                {...perBucket(objectSpark(o.key), objects[o.key])}
              />
            ))}
          </div>
        </section>
      )}

      {created.length > 0 && (
        <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">{t("dashboard.sections.created")}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {created.map(([key, metric]) => (
              <MetricCard
                key={key}
                compact
                title={objectLabel(key, metric.label)}
                polarity="up_is_good"
                {...perBucket(objectSpark(key), metric)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Overview figures are aggregated every 15 min on the server: reload them on that rhythm while today is shown. */
const AUTO_REFRESH_MS = 5 * 60_000;

/**
 * Today's daily works as they happen (ws/stats/live/): the overview below is
 * aggregated, so without this its numbers only move every quarter of an hour.
 */
function TodayLive() {
  const { t } = useTranslation();
  const { status, data } = useLiveStats();
  if (status === "forbidden" || status === "unauthorized" || !data) return null;
  return (
    <section aria-labelledby="today-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-title" className="flex items-center gap-2 text-base font-semibold">
          <span className="relative flex h-2 w-2" aria-hidden>
            {status === "open" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--live)] opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${status === "open" ? "bg-[color:var(--live)]" : "bg-[color:var(--series-4)]"}`} />
          </span>
          {t("dashboard.today.title")}
        </h2>
        <Link to="/live" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {t("dashboard.today.open")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <KpiRow data={data} />
      {data.today.top_workers && (
        <SectionCard title={t("live.topWorkers.title")} description={t("live.topWorkers.description")}>
          <TopWorkers rows={data.today.top_workers} limit={5} />
        </SectionCard>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayInStatsTimezone(), []);
  // The URL is the state: shared links, refresh and back/forward all restore it.
  const filters = useMemo(() => parseFilters(searchParams, today), [searchParams, today]);
  const params = useMemo(() => toApiParams(filters, today), [filters, today]);
  const overview = useOverview(params);

  // A period that includes today keeps moving: refresh it while the tab is visible.
  const { retry } = overview;
  useEffect(() => {
    if (params.date_to !== today) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") retry();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [params.date_to, today, retry]);

  // A malformed or reversed shared link is rewritten to what is shown, without a new history entry.
  useEffect(() => {
    const canonical = serializeFilters(filters);
    if (canonical.toString() !== searchParams.toString()) setSearchParams(canonical, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  const changeFilters = useCallback(
    (next: Filters) => {
      const query = serializeFilters(next);
      if (query.toString() !== searchParams.toString()) setSearchParams(query); // one history entry per change
    },
    [searchParams, setSearchParams],
  );

  const sessionExpired =
    overview.status === "error" && overview.error instanceof ApiError && overview.error.status === 401;
  useEffect(() => {
    if (sessionExpired) {
      endSession();
      toast.error(t("auth.sessionExpired"));
      const next = `/${searchParams.toString() ? `?${searchParams}` : ""}`;
      navigate(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [sessionExpired, navigate, searchParams, t]);

  // After an error nothing from the previous filters stays on screen under the new ones.
  const data = overview.status === "error" ? null : overview.data;
  const loading = overview.status === "loading";

  const generatedAt = data && formatDateTime(data.meta.generated_at, data.meta.timezone);

  return (
    <AppShell
      status={
        loading &&
        data && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span className="hidden sm:inline">{t("common.refreshing")}</span>
          </span>
        )
      }
    >
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t("dashboard.periodMeta", { range: formatRange(params.date_from, params.date_to) })}
            </span>
            {data && (
              <span>
                {t("dashboard.comparison", {
                  range: formatRange(data.meta.previous_period.date_from, data.meta.previous_period.date_to),
                })}
              </span>
            )}
            {generatedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {t("dashboard.generatedAt", { time: generatedAt })}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              onClick={overview.retry}
              disabled={loading}
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {t("common.refresh")}
            </Button>
            <ExportMenu params={params} />
          </>
        }
      />

      <TodayLive />

      <FilterBar filters={filters} params={params} today={today} onChange={changeFilters} />

      {overview.status === "error" && !sessionExpired && (
        <ErrorState message={errorMessage(overview.error, t)} onRetry={overview.retry} />
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        <main className={`space-y-8 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
          <SummaryCards data={data} today={today} />

          <section aria-labelledby="trends-title" className="space-y-3">
            <SectionTitle
              id="trends-title"
              title={t("dashboard.sections.trends")}
              hint={t("dashboard.sections.trendsHint", { granularity: granularityLabel(data.meta.granularity).toLowerCase() })}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <RegistrationsPanel data={data} params={params} />
              <ActivityPanel data={data} params={params} />
            </div>
            <ObjectsPanel data={data} params={params} />
          </section>

          <FunnelSection data={data} params={params} dimensionFiltersActive={hasDimensionFilters(filters)} />

          <section aria-labelledby="distribution-title" className="space-y-3">
            <SectionTitle
              id="distribution-title"
              title={t("dashboard.sections.distribution")}
              hint={t("dashboard.sections.distributionHint")}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionPanel
                title={t("panels.distribution.country")}
                table="country"
                params={params}
                total={data.summary.users.new_registrations.value ?? 0}
                color={seriesColor(0)}
                rows={data.breakdowns.country.map((r) => ({ ...r, key: r.country, label: countryLabel(r.country) }))}
              />
              <DistributionPanel
                title={t("panels.distribution.method")}
                table="registered_via"
                params={params}
                total={data.summary.users.new_registrations.value ?? 0}
                color={seriesColor(0)}
                rows={data.breakdowns.registered_via.map((r) => ({
                  ...r,
                  key: r.registered_via,
                  label: methodLabel(r.registered_via),
                }))}
              />
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            {t("dashboard.footer", { time: generatedAt })}
          </p>
        </main>
      )}
    </AppShell>
  );
}
