import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { ActivityPanel } from "../components/stats/ActivityPanel";
import { DistributionPanel } from "../components/stats/DistributionPanel";
import { FilterBar } from "../components/stats/FilterBar";
import { FunnelSection } from "../components/stats/FunnelSection";
import { MetricCard } from "../components/stats/MetricCard";
import { ObjectsPanel } from "../components/stats/ObjectsPanel";
import { RegistrationsPanel } from "../components/stats/RegistrationsPanel";
import { DashboardSkeleton, ErrorState } from "../components/stats/states";
import { ApiError, clearSession } from "../lib/api";
import { formatRange, todayInStatsTimezone } from "../lib/dates";
import { hasDimensionFilters, parseFilters, serializeFilters, toApiParams, type Filters } from "../lib/filters";
import { METHOD_LABELS, countryLabel, objectLabel, seriesColor } from "../lib/metrics";
import { clearOverviewCache, useOverview } from "../lib/useOverview";
import type { Overview } from "../lib/types";

function readUser(): { phone_number?: string; email?: string } | null {
  try {
    return JSON.parse(localStorage.getItem("user") ?? "null");
  } catch {
    return null;
  }
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Statistikani ko'rish huquqi yo'q (statistics | daily statistic | Can view).";
    if (error.status >= 500) return "Serverda xatolik. Birozdan keyin qayta urinib ko'ring.";
    return error.message;
  }
  return "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring.";
}

function endSession() {
  clearSession();
  clearOverviewCache(); // responses carry viewer-specific parts (admin_url)
}

function SummaryCards({ data }: { data: Overview }) {
  const { users, activity } = data.summary;
  // "Created objects": only metrics counted at creation; completions, cancellations and payments are in the chart.
  const created = Object.entries(data.summary.objects).filter(([, m]) => m.kind === "created");
  return (
    <section aria-labelledby="summary-title" className="space-y-4">
      <h2 id="summary-title" className="sr-only">
        Asosiy ko'rsatkichlar
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <MetricCard
          title="Yangi ro'yxatdan o'tishlar"
          metric={users.new_registrations}
          polarity="up_is_good"
          hint="Davrda yaratilgan akkauntlar"
        />
        <MetricCard
          title="DAU (kunlik o'rtacha)"
          metric={activity.dau_average}
          polarity="up_is_good"
          hint="Davrning har bir kunidagi noyob faol foydalanuvchilar o'rtachasi"
        />
        <MetricCard
          title="WAU"
          metric={activity.wau}
          polarity="up_is_good"
          hint="Davr oxirgi kuni bilan tugaydigan 7 kunda faol bo'lgan noyob foydalanuvchilar"
        />
        <MetricCard
          title="MAU"
          metric={activity.mau}
          polarity="up_is_good"
          hint="Davr oxirgi kuni bilan tugaydigan 30 kunda faol bo'lgan noyob foydalanuvchilar"
        />
        <MetricCard
          title="Jami foydalanuvchilar"
          metric={users.total_users}
          polarity="up_is_good"
          hint="Davr oxirigacha ro'yxatdan o'tgan va o'chirilmagan akkauntlar"
        />
      </div>
      {created.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">Yaratilgan obyektlar</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {created.map(([key, metric]) => (
              <MetricCard key={key} compact title={objectLabel(key, metric.label)} metric={metric} polarity="up_is_good" />
            ))}
          </div>
        </div>
      )}
    </section>
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
  const user = useMemo(readUser, []);

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

  const logout = () => {
    endSession();
    toast.success("Tizimdan chiqdingiz");
    navigate("/login");
  };

  // After an error nothing from the previous filters stays on screen under the new ones.
  const data = overview.status === "error" ? null : overview.data;
  const loading = overview.status === "loading";

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">GUDS statistikasi</h1>
            <p className="text-sm text-muted-foreground">
              {formatRange(params.date_from, params.date_to)} · Toshkent vaqti
              {data && (
                <> · taqqoslash: {formatRange(data.meta.previous_period.date_from, data.meta.previous_period.date_to)}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && data && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Yangilanmoqda…
              </span>
            )}
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.phone_number ?? user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" aria-hidden />
              Chiqish
            </Button>
          </div>
        </header>

        <FilterBar filters={filters} params={params} today={today} onChange={changeFilters} />

        {overview.status === "error" && !sessionExpired && (
          <ErrorState message={errorMessage(overview.error)} onRetry={overview.retry} />
        )}

        {!data && loading && <DashboardSkeleton />}

        {data && (
          <main className={`space-y-6 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            <SummaryCards data={data} />

            <div className="grid gap-4 xl:grid-cols-2">
              <RegistrationsPanel data={data} params={params} />
              <ActivityPanel data={data} params={params} />
            </div>

            <ObjectsPanel data={data} params={params} />

            <FunnelSection data={data} params={params} dimensionFiltersActive={hasDimensionFilters(filters)} />

            <section aria-labelledby="distribution-title" className="space-y-4">
              <h2 id="distribution-title" className="text-lg font-semibold">
                Taqsimot
              </h2>
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
              Bugungi ko'rsatkichlar har 15 daqiqada yangilanadi · hisoblangan:{" "}
              {new Date(data.meta.generated_at).toLocaleString("ru-RU", {
                timeZone: data.meta.timezone,
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
