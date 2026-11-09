import { useEffect, useState } from "react";
import { PageHeader, SectionCard } from "../components/layout/Page";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Clock3, RotateCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell, endSession } from "../components/layout/AppShell";
import {
  HourlyJobsChart,
  JobPipeline,
  LiveTrendChart,
  TopCategories,
  WorkerStatesMeter,
  type CompareWith,
} from "../components/live/LiveCharts";
import { KpiRow, TopWorkers } from "../components/live/LiveKpis";
import { JobsTable, WorkersTable } from "../components/live/LiveTables";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { formatClock, formatNumber } from "../lib/format";
import { useLiveStats, useNow, type LiveStatus } from "../lib/live";

const STATUS_VIEW: Record<LiveStatus, { dot: string; pulse: boolean }> = {
  open: { dot: "bg-[color:var(--live)]", pulse: true },
  connecting: { dot: "bg-[color:var(--series-4)]", pulse: false },
  reconnecting: { dot: "bg-[color:var(--series-4)]", pulse: false },
  unauthorized: { dot: "bg-[color:var(--delta-bad)]", pulse: false },
  forbidden: { dot: "bg-[color:var(--delta-bad)]", pulse: false },
};

function LiveBadge({ status }: { status: LiveStatus }) {
  const { t } = useTranslation();
  const view = STATUS_VIEW[status];
  return (
    <span role="status" className="flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        {view.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${view.dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${view.dot}`} />
      </span>
      {t(`live.status.${status}`)}
    </span>
  );
}

function LiveSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" aria-label={t("common.loading")} className="space-y-6">
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

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border bg-muted/50 p-0.5">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function LivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, data, history, receivedAt, refresh } = useLiveStats();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("workers");
  const [compareWith, setCompareWith] = useState<CompareWith>("yesterday");

  useEffect(() => {
    if (status === "unauthorized") {
      endSession();
      toast.error(t("auth.sessionExpired"));
      navigate(`/login?next=${encodeURIComponent("/live")}`, { replace: true });
    }
  }, [status, navigate, t]);

  return (
    <AppShell status={<LiveBadge status={status} />}>
      <PageHeader
        title={t("live.title")}
        description={t("live.description")}
        meta={
          receivedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {t("live.lastUpdate", { time: formatClock(receivedAt) })}
            </span>
          )
        }
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={refresh} disabled={status !== "open"}>
            <RotateCw className="h-4 w-4" aria-hidden />
            {t("common.refresh")}
          </Button>
        }
      />

      {status === "forbidden" && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-6 shadow-card">
          <ShieldAlert className="h-5 w-5 text-[color:var(--delta-bad)]" aria-hidden />
          <p className="text-sm">{t("live.forbidden")}</p>
        </div>
      )}

      {!data && status !== "forbidden" && <LiveSkeleton />}

      {data && (
        <main className="space-y-6">
          <KpiRow data={data} />

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              className="xl:col-span-2"
              title={t("live.trend.title")}
              description={t("live.trend.description")}
            >
              <LiveTrendChart history={history} />
            </SectionCard>
            <SectionCard
              title={t("live.workerStates.title")}
              description={t("live.workerStates.online", { count: data.counts.workers.total })}
            >
              <WorkerStatesMeter counts={data.counts.workers} />
              <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-5 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("live.workerStates.registered")}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(data.counts.registered_workers)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("live.workerStates.verified")}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(data.counts.verified_workers)}</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <SectionCard
              className="lg:col-span-2"
              title={t("live.hourly.title")}
              description={t("live.hourly.description")}
              action={
                data.today.compare && (
                  <Segmented
                    label={t("live.compare.label")}
                    value={compareWith}
                    onChange={setCompareWith}
                    options={[
                      ["yesterday", t("live.compare.yesterday")],
                      ["week_ago", t("live.compare.weekAgo")],
                      ["none", t("live.compare.none")],
                    ]}
                  />
                )
              }
            >
              <HourlyJobsChart data={data.today.by_hour} compare={data.today.compare} compareWith={compareWith} />
            </SectionCard>
            <SectionCard title={t("live.pipeline.title")} description={t("live.pipeline.active", { count: data.counts.jobs.total })}>
              <JobPipeline counts={data.counts.jobs} />
            </SectionCard>
            <SectionCard title={t("live.categories.title")} description={t("live.categories.description")}>
              <TopCategories rows={data.today.by_category} />
            </SectionCard>
          </div>

          {data.today.top_workers && (
            <SectionCard title={t("live.topWorkers.title")} description={t("live.topWorkers.description")}>
              <TopWorkers rows={data.today.top_workers} />
            </SectionCard>
          )}

          <SectionCard
            title={tab === "workers" ? t("live.workers.title") : t("live.jobs.title")}
            action={
              <div role="tablist" aria-label={t("live.tabs.label")} className="inline-flex rounded-full border bg-muted/50 p-0.5">
                {(
                  [
                    ["workers", t("live.tabs.workers", { count: data.counts.workers.total })],
                    ["jobs", t("live.tabs.jobs", { count: data.counts.jobs.total })],
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
