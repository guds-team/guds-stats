import { useEffect, useState } from "react";
import { PageHeader, SectionCard, useAnimatedNumber } from "../components/layout/Page";
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
  format = formatNumber,
  children,
  accent,
  className = "",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  format?: (value: number) => string;
  children?: React.ReactNode;
  accent: string;
  className?: string;
}) {
  const shown = useAnimatedNumber(value) ?? value;
  return (
    <div className={`kpi-card flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] text-muted-foreground">{label}</p>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </span>
      </div>
      <p className="text-2xl leading-8 font-semibold tracking-tight tabular-nums 2xl:text-[28px] 2xl:leading-9" title={format(value)}>
        {format(shown)}
      </p>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

function KpiRow({ data }: { data: LiveSnapshot }) {
  const { counts, today } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
      <Kpi icon={Users} label="Onlayn ishchilar" value={counts.workers.total} accent="var(--series-1)">
        {formatNumber(counts.workers.online_idle)} bo'sh · {formatNumber(counts.workers.on_job)} ishda · ro'yxatda{" "}
        {formatNumber(counts.registered_workers)}
      </Kpi>
      <Kpi icon={Activity} label="Faol ishlar" value={counts.jobs.total} accent="var(--series-2)">
        {formatNumber(counts.jobs.pending + counts.jobs.offered)} tasi ishchi kutmoqda
      </Kpi>
      <Kpi icon={Briefcase} label="Bugun joylangan" value={today.created} accent="var(--series-3)">
        {formatNumber(today.expired)} muddati o'tgan
      </Kpi>
      <Kpi icon={CheckCircle2} label="Bugun bajarilgan" value={today.completed} accent="var(--series-6)">
        {formatNumber(today.cancelled)} bekor qilingan
        {today.created > 0 && <> · {Math.round((today.completed / today.created) * 100)}% bajarilish</>}
      </Kpi>
      <Kpi className="col-span-2 xl:col-span-1" icon={Wallet} label="Bugungi aylanma" value={today.revenue}
        format={(v) => formatMoney(v, "UZS", true)} accent="var(--series-7)">
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
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
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
      <PageHeader
        title="Jonli kuzatuv"
        description="Kunlik ishlar: onlayn ishchilar va jarayondagi ishlar. Ma'lumot o'zgarganda server o'zi yuboradi."
        meta={
          receivedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Oxirgi yangilanish: {formatClock(receivedAt)}
            </span>
          )
        }
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={refresh} disabled={status !== "open"}>
            <RotateCw className="h-4 w-4" aria-hidden />
            Yangilash
          </Button>
        }
      />

      {status === "forbidden" && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-6 shadow-card">
          <ShieldAlert className="h-5 w-5 text-[color:var(--delta-bad)]" aria-hidden />
          <p className="text-sm">Jonli kuzatuvni ko'rish huquqi yo'q (statistics | daily statistic | Can view).</p>
        </div>
      )}

      {!data && status !== "forbidden" && <LiveSkeleton />}

      {data && (
        <main className="space-y-6">
          <KpiRow data={data} />

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              className="xl:col-span-2"
              title="Jonli trend"
              description="Onlayn ishchilar va faol ishlar soni — sahifa ochilgandan beri"
            >
              <LiveTrendChart history={history} />
            </SectionCard>
            <SectionCard title="Ishchilar holati" description={`${formatNumber(data.counts.workers.total)} ta onlayn`}>
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
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <SectionCard
              className="lg:col-span-2"
              title="Bugun soatlar bo'yicha"
              description="Joylangan va bajarilgan ishlar, Toshkent vaqti"
            >
              <HourlyJobsChart data={data.today.by_hour} />
            </SectionCard>
            <SectionCard title="Ishlar bosqichlari" description={`${formatNumber(data.counts.jobs.total)} ta faol ish`}>
              <JobPipeline counts={data.counts.jobs} />
            </SectionCard>
            <SectionCard title="Bugungi top kategoriyalar" description="Joylangan ishlar soni bo'yicha">
              <TopCategories rows={data.today.by_category} />
            </SectionCard>
          </div>

          <SectionCard
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
          </SectionCard>
        </main>
      )}
    </AppShell>
  );
}
