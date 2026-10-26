import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Activity, Briefcase, CheckCircle2, Clock3, RotateCw, ShieldAlert, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import { HourlyJobsChart, JobPipeline, LiveTrendChart, TopCategories, WorkerStatesMeter } from "../components/live/LiveCharts";
import { JobsTable, WorkersTable } from "../components/live/LiveTables";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { formatClock, formatMoney, formatNumber } from "../lib/format";
import { useLiveStats, useNow, type LiveSnapshot, type LiveStatus } from "../lib/live";

const STATUS_VIEW: Record<LiveStatus, { label: string; dot: string; pulse: boolean }> = {
  open: { label: "Jonli", dot: "bg-[color:var(--live)]", pulse: true },
  connecting: { label: "Ulanmoqda…", dot: "bg-[color:var(--series-4)]", pulse: false },
  reconnecting: { label: "Qayta ulanmoqda…", dot: "bg-[color:var(--series-4)]", pulse: false },
  unauthorized: { label: "Sessiya tugadi", dot: "bg-[color:var(--delta-bad)]", pulse: false },
  forbidden: { label: "Ruxsat yo'q", dot: "bg-[color:var(--delta-bad)]", pulse: false },
};

function LiveBadge({ status }: { status: LiveStatus }) {
  const view = STATUS_VIEW[status];
  return (
    <span role="status" className="flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        {view.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${view.dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${view.dot}`} />
      </span>
      {view.label}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
  accent,
  className = "",
}: {
  className?: string;
  icon: typeof Users;
  label: string;
  value: string;
  children?: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`kpi-card relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.12] blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-muted" aria-hidden>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {children && <div className="mt-2 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

function Card({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section aria-label={title} className={`rounded-2xl border bg-card p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiRow({ data }: { data: LiveSnapshot }) {
  const { counts, today } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
      <Kpi icon={Users} label="Onlayn ishchilar" value={formatNumber(counts.workers.total)} accent="var(--series-1)">
        {formatNumber(counts.workers.online_idle)} bo'sh · {formatNumber(counts.workers.on_job)} ishda · ro'yxatda{" "}
        {formatNumber(counts.registered_workers)}
      </Kpi>
      <Kpi icon={Activity} label="Faol ishlar" value={formatNumber(counts.jobs.total)} accent="var(--series-2)">
        {formatNumber(counts.jobs.pending + counts.jobs.offered)} tasi ishchi kutmoqda
      </Kpi>
      <Kpi icon={Briefcase} label="Bugun joylangan" value={formatNumber(today.created)} accent="var(--series-3)">
        {formatNumber(today.expired)} muddati o'tgan
      </Kpi>
      <Kpi icon={CheckCircle2} label="Bugun bajarilgan" value={formatNumber(today.completed)} accent="var(--series-6)">
        {formatNumber(today.cancelled)} bekor qilingan
        {today.created > 0 && <> · {Math.round((today.completed / today.created) * 100)}% bajarilish</>}
      </Kpi>
      <Kpi className="col-span-2 xl:col-span-1" icon={Wallet} label="Bugungi aylanma" value={formatMoney(today.revenue, "UZS", true)} accent="var(--series-7)">
        Komissiya: {formatMoney(today.commission)}
      </Kpi>
    </div>
  );
}

function LiveSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[360px] rounded-2xl xl:col-span-2" />
        <Skeleton className="h-[360px] rounded-2xl" />
      </div>
    </div>
  );
}

type Tab = "workers" | "jobs";

export function LivePage() {
  const navigate = useNavigate();
  const { status, data, history, receivedAt, refresh } = useLiveStats();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("workers");

  useEffect(() => {
    if (status === "unauthorized") {
      endSession();
      toast.error("Sessiya tugadi, qayta kiring");
      navigate(`/login?next=${encodeURIComponent("/live")}`, { replace: true });
    }
  }, [status, navigate]);

  return (
    <AppShell status={<LiveBadge status={status} />}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Jonli kuzatuv</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kunlik ishlar: onlayn ishchilar va jarayondagi ishlar · WebSocket orqali avtomatik yangilanadi
          </p>
        </div>
        {receivedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Oxirgi yangilanish: {formatClock(receivedAt)}
            <Button variant="outline" size="sm" className="ml-1 h-7 gap-1.5 rounded-full" onClick={refresh} disabled={status !== "open"}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Yangilash
            </Button>
          </div>
        )}
      </div>

      {status === "forbidden" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-dashed p-6">
          <ShieldAlert className="h-5 w-5 text-[color:var(--delta-bad)]" aria-hidden />
          <p className="text-sm">Jonli kuzatuvni ko'rish huquqi yo'q (statistics | daily statistic | Can view).</p>
        </div>
      )}

      {!data && status !== "forbidden" && <LiveSkeleton />}

      {data && (
        <main className="space-y-6">
          <KpiRow data={data} />

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Jonli trend"
              description="Onlayn ishchilar va faol ishlar soni — sahifa ochilgandan beri"
            >
              <LiveTrendChart history={history} />
            </Card>
            <Card title="Ishchilar holati" description={`${formatNumber(data.counts.workers.total)} ta onlayn`}>
              <WorkerStatesMeter counts={data.counts.workers} />
              <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-5 text-sm">
                <div>
                  <p className="text-muted-foreground">Ro'yxatdagi ishchilar</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(data.counts.registered_workers)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tasdiqlanganlar</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(data.counts.verified_workers)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <Card
              className="lg:col-span-2"
              title="Bugun soatlar bo'yicha"
              description="Joylangan va bajarilgan ishlar, Toshkent vaqti"
            >
              <HourlyJobsChart data={data.today.by_hour} />
            </Card>
            <Card title="Ishlar bosqichlari" description={`${formatNumber(data.counts.jobs.total)} ta faol ish`}>
              <JobPipeline counts={data.counts.jobs} />
            </Card>
            <Card title="Bugungi top kategoriyalar" description="Joylangan ishlar soni bo'yicha">
              <TopCategories rows={data.today.by_category} />
            </Card>
          </div>

          <Card
            title={tab === "workers" ? "Onlayn ishchilar" : "Faol ishlar"}
            action={
              <div role="tablist" aria-label="Jadval" className="inline-flex rounded-full border bg-muted/50 p-0.5">
                {(
                  [
                    ["workers", `Ishchilar · ${formatNumber(data.counts.workers.total)}`],
                    ["jobs", `Ishlar · ${formatNumber(data.counts.jobs.total)}`],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    type="button"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {tab === "workers" ? (
              <WorkersTable workers={data.workers} now={now} limit={data.limits.workers} total={data.counts.workers.total} />
            ) : (
              <JobsTable jobs={data.jobs} now={now} limit={data.limits.jobs} total={data.counts.jobs.total} />
            )}
          </Card>
        </main>
      )}
    </AppShell>
  );
}
