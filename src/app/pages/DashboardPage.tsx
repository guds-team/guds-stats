import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CalendarDays, Clock3, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/Page";
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
import { formatRange, todayInStatsTimezone } from "../lib/dates";
import { hasDimensionFilters, parseFilters, serializeFilters, toApiParams, type Filters } from "../lib/filters";
import { GRANULARITY_LABELS, METHOD_LABELS, countryLabel, objectLabel, seriesColor } from "../lib/metrics";
import type { Polarity } from "../lib/format";
import { useOverview } from "../lib/useOverview";
import type { Overview } from "../lib/types";

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Statistikani ko'rish huquqi yo'q (statistics | daily statistic | Can view).";
    if (error.status >= 500) return "Serverda xatolik. Birozdan keyin qayta urinib ko'ring.";
    return error.message;
  }
  return "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring.";
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
const OUTCOMES: { key: string; polarity: Polarity; hint: string }[] = [
  { key: "dw_jobs_completed", polarity: "up_is_good", hint: "Davrda bajarib bo'lingan kunlik ishlar" },
  { key: "dw_jobs_cancelled", polarity: "up_is_bad", hint: "Davrda bekor qilingan kunlik ishlar" },
  { key: "payments_succeeded", polarity: "up_is_good", hint: "Davrda muvaffaqiyatli yakunlangan to'lovlar soni" },
  { key: "payments_failed", polarity: "up_is_bad", hint: "Davrda muvaffaqiyatsiz bo'lgan to'lovlar soni" },
];

function SummaryCards({ data }: { data: Overview }) {
  const { users, activity } = data.summary;
  const daily = data.meta.granularity === "day";
  const objects = data.summary.objects;
  // "Created objects": only metrics counted at creation; completions, cancellations and payments are separate.
  const created = Object.entries(objects).filter(([, m]) => m.kind === "created");
  const outcomes = OUTCOMES.filter((o) => objects[o.key]);
  const objectSpark = (key: string) => data.series.objects.map((p) => (p[key] as number | undefined) ?? null);
  return (
    <div className="space-y-6">
      <section aria-labelledby="summary-title" className="space-y-3">
        <SectionTitle id="summary-title" title="Foydalanuvchilar" hint="Oldingi teng davr bilan taqqoslanadi" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <MetricCard
            title="Yangi ro'yxatdan o'tishlar"
            metric={users.new_registrations}
            polarity="up_is_good"
            hint="Davrda yaratilgan akkauntlar"
            spark={data.series.registrations.map((p) => p.registrations)}
          />
          <MetricCard
            title="DAU (kunlik o'rtacha)"
            metric={activity.dau_average}
            polarity="up_is_good"
            hint="Davrning har bir kunidagi noyob faol foydalanuvchilar o'rtachasi"
            spark={data.series.activity.map((p) => (daily ? p.dau : p.dau_average) ?? null)}
          />
          <MetricCard
            title="WAU"
            metric={activity.wau}
            polarity="up_is_good"
            hint="Davr oxirgi kuni bilan tugaydigan 7 kunda faol bo'lgan noyob foydalanuvchilar"
            spark={daily ? data.series.activity.map((p) => p.wau ?? null) : undefined}
          />
          <MetricCard
            title="MAU"
            metric={activity.mau}
            polarity="up_is_good"
            hint="Davr oxirgi kuni bilan tugaydigan 30 kunda faol bo'lgan noyob foydalanuvchilar"
            spark={daily ? data.series.activity.map((p) => p.mau ?? null) : undefined}
          />
          <MetricCard
            title="Jami foydalanuvchilar"
            metric={users.total_users}
            polarity="up_is_good"
            hint="Davr oxirigacha ro'yxatdan o'tgan va o'chirilmagan akkauntlar"
          />
        </div>
      </section>

      {outcomes.length > 0 && (
        <section aria-labelledby="outcomes-title" className="space-y-3">
          <SectionTitle id="outcomes-title" title="Kunlik ishlar va to'lovlar" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {outcomes.map((o) => (
              <MetricCard
                key={o.key}
                title={objectLabel(o.key, objects[o.key].label)}
                metric={objects[o.key]}
                polarity={o.polarity}
                hint={o.hint}
                spark={objectSpark(o.key)}
              />
            ))}
          </div>
        </section>
      )}

      {created.length > 0 && (
        <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">Yaratilgan obyektlar</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {created.map(([key, metric]) => (
              <MetricCard key={key} compact title={objectLabel(key, metric.label)} metric={metric} polarity="up_is_good" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayInStatsTimezone(), []);
  // The URL is the state: shared links, refresh and back/forward all restore it.
  const filters = useMemo(() => parseFilters(searchParams, today), [searchParams, today]);
  const params = useMemo(() => toApiParams(filters, today), [filters, today]);
  const overview = useOverview(params);

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
      toast.error("Sessiya tugadi, qayta kiring");
      const next = `/${searchParams.toString() ? `?${searchParams}` : ""}`;
      navigate(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [sessionExpired, navigate, searchParams]);

  // After an error nothing from the previous filters stays on screen under the new ones.
  const data = overview.status === "error" ? null : overview.data;
  const loading = overview.status === "loading";

  const generatedAt =
    data &&
    new Date(data.meta.generated_at).toLocaleString("ru-RU", {
      timeZone: data.meta.timezone,
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <AppShell
      status={
        loading &&
        data && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span className="hidden sm:inline">Yangilanmoqda…</span>
          </span>
        )
      }
    >
      <PageHeader
        title="GUDS statistikasi"
        description="Platformaning foydalanuvchilar, faollik, kunlik ishlar va autentifikatsiya ko'rsatkichlari"
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {formatRange(params.date_from, params.date_to)} · Toshkent vaqti
            </span>
            {data && (
              <span>taqqoslash: {formatRange(data.meta.previous_period.date_from, data.meta.previous_period.date_to)}</span>
            )}
            {generatedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                hisoblangan: {generatedAt}
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
              Yangilash
            </Button>
            <ExportMenu params={params} />
          </>
        }
      />

      <FilterBar filters={filters} params={params} today={today} onChange={changeFilters} />

      {overview.status === "error" && !sessionExpired && (
        <ErrorState message={errorMessage(overview.error)} onRetry={overview.retry} />
      )}

      {!data && loading && <DashboardSkeleton />}

      {data && (
        <main className={`space-y-8 transition-opacity ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
          <SummaryCards data={data} />

          <section aria-labelledby="trends-title" className="space-y-3">
            <SectionTitle id="trends-title" title="Dinamika" hint={`Guruhlash: ${GRANULARITY_LABELS[data.meta.granularity].toLowerCase()}`} />
            <div className="grid gap-4 xl:grid-cols-2">
              <RegistrationsPanel data={data} params={params} />
              <ActivityPanel data={data} params={params} />
            </div>
            <ObjectsPanel data={data} params={params} />
          </section>

          <FunnelSection data={data} params={params} dimensionFiltersActive={hasDimensionFilters(filters)} />

          <section aria-labelledby="distribution-title" className="space-y-3">
            <SectionTitle id="distribution-title" title="Taqsimot" hint="Davrdagi yangi ro'yxatdan o'tishlar ulushi" />
            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionPanel
                title="Davlatlar bo'yicha"
                table="country"
                params={params}
                total={data.summary.users.new_registrations.value ?? 0}
                color={seriesColor(0)}
                rows={data.breakdowns.country.map((r) => ({ ...r, key: r.country, label: countryLabel(r.country) }))}
              />
              <DistributionPanel
                title="Ro'yxatdan o'tish usuli bo'yicha"
                table="registered_via"
                params={params}
                total={data.summary.users.new_registrations.value ?? 0}
                color={seriesColor(0)}
                rows={data.breakdowns.registered_via.map((r) => ({
                  ...r,
                  key: r.registered_via,
                  label: METHOD_LABELS[r.registered_via] ?? r.registered_via,
                }))}
              />
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Bugungi ko'rsatkichlar har 15 daqiqada yangilanadi · hisoblangan: {generatedAt}
          </p>
        </main>
      )}
    </AppShell>
  );
}
