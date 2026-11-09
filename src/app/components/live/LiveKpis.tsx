import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Activity, Briefcase, CheckCircle2, Users, Wallet } from "lucide-react";
import { useAnimatedNumber } from "../layout/Page";
import { EmptyState } from "../stats/states";
import { formatDay } from "../../lib/dates";
import { formatMoney, formatNumber, formatPercent, type Polarity } from "../../lib/format";
import type { DayCounters, LiveSnapshot, TopWorker } from "../../lib/live";

type CounterKey = keyof DayCounters;

/** "+25%" against a previous value; "+3" when it was 0; "0" when equal. */
export function changeAgainst(current: number, previous: number, polarity: Polarity = "up_is_good") {
  const change = current - previous;
  if (change === 0) return { text: "0", tone: "neutral" as const, trend: "flat" as const };
  const trend = change > 0 ? ("up" as const) : ("down" as const);
  const sign = change > 0 ? "+" : "−";
  const text =
    previous > 0
      ? `${sign}${formatPercent(Math.round((Math.abs(change) / previous) * 1000) / 10)}`
      : `${sign}${formatNumber(Math.abs(change))}`;
  const tone: "good" | "bad" | "neutral" =
    polarity === "neutral" ? "neutral" : (trend === "up") === (polarity === "up_is_good") ? "good" : "bad";
  return { text, tone, trend };
}

const TONE = {
  good: "text-[color:var(--delta-good)]",
  bad: "text-[color:var(--delta-bad)]",
  neutral: "text-muted-foreground",
} as const;

/** Today so far against yesterday and a week ago up to the same time of day. */
function CompareRows({
  data,
  field,
  value,
  format = formatNumber,
  polarity = "up_is_good",
}: {
  data: LiveSnapshot;
  field: CounterKey;
  value: number;
  format?: (value: number) => string;
  polarity?: Polarity;
}) {
  const { t } = useTranslation();
  const compare = data.today.compare;
  if (!compare) return null;
  const rows = [
    ["yesterday", compare.yesterday],
    ["weekAgo", compare.week_ago],
  ] as const;
  return (
    <dl className="mt-auto space-y-1 border-t pt-2 text-xs">
      {rows.map(([key, day]) => {
        const previous = day[field];
        if (previous === undefined) return null;
        const change = changeAgainst(value, previous, polarity);
        const Arrow = change.trend === "up" ? ArrowUp : change.trend === "down" ? ArrowDown : null;
        return (
          <div key={key} className="flex items-center justify-between gap-2" title={t(`live.compare.${key}Title`, { date: formatDay(day.date, true) })}>
            <dt className="truncate text-muted-foreground">{t(`live.compare.${key}`)}</dt>
            <dd className="flex shrink-0 items-center gap-1.5 tabular-nums">
              <span>{format(previous)}</span>
              <span className={`inline-flex items-center font-medium ${TONE[change.tone]}`}>
                {Arrow && <Arrow className="h-3 w-3" aria-hidden />}
                {change.text}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  format = formatNumber,
  children,
  compare,
  accent,
  className = "",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  format?: (value: number) => string;
  children?: React.ReactNode;
  compare?: React.ReactNode;
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
      {compare}
    </div>
  );
}

/** Online workers, active jobs and today's counters, each against yesterday and a week ago. */
export function KpiRow({ data }: { data: LiveSnapshot }) {
  const { t } = useTranslation();
  const { counts, today } = data;
  const money = (v: number) => formatMoney(v, "UZS", true);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
      <Kpi
        icon={Users}
        label={t("live.kpi.onlineWorkers")}
        value={counts.workers.total}
        accent="var(--series-1)"
        compare={today.workers !== undefined && (
          <>
            <p className="border-t pt-2 text-xs text-muted-foreground">
              {t("live.kpi.workedToday", { count: today.workers })}
            </p>
            <CompareRows data={data} field="workers" value={today.workers} />
          </>
        )}
      >
        {t("live.kpi.onlineWorkersDetail", {
          idle: formatNumber(counts.workers.online_idle),
          onJob: formatNumber(counts.workers.on_job),
          registered: formatNumber(counts.registered_workers),
        })}
      </Kpi>
      <Kpi icon={Activity} label={t("live.kpi.activeJobs")} value={counts.jobs.total} accent="var(--series-2)">
        {t("live.kpi.waiting", { count: counts.jobs.pending + counts.jobs.offered })}
      </Kpi>
      <Kpi icon={Briefcase} label={t("live.kpi.postedToday")} value={today.created} accent="var(--series-3)"
        compare={<CompareRows data={data} field="created" value={today.created} />}>
        {t("live.kpi.expired", { count: today.expired })}
      </Kpi>
      <Kpi icon={CheckCircle2} label={t("live.kpi.completedToday")} value={today.completed} accent="var(--series-6)"
        compare={<CompareRows data={data} field="completed" value={today.completed} />}>
        {t("live.kpi.cancelled", { count: today.cancelled })}
        {today.created > 0 && (
          <> · {t("live.kpi.completionRate", { percent: formatPercent(Math.round((today.completed / today.created) * 100)) })}</>
        )}
      </Kpi>
      <Kpi className="col-span-2 xl:col-span-1" icon={Wallet} label={t("live.kpi.revenueToday")} value={today.revenue}
        format={money} accent="var(--series-7)"
        compare={<CompareRows data={data} field="revenue" value={today.revenue} format={money} />}>
        {t("live.kpi.commission", { amount: formatMoney(today.commission) })}
      </Kpi>
    </div>
  );
}

/** Today's top earners: completed jobs and turnover per worker, the platform's commission apart. */
export function TopWorkers({ rows, limit }: { rows: TopWorker[] | undefined; limit?: number }) {
  const { t } = useTranslation();
  if (!rows?.length) return <EmptyState hint={t("live.topWorkers.emptyHint")}>{t("live.topWorkers.empty")}</EmptyState>;
  const shown = limit ? rows.slice(0, limit) : rows;
  const max = Math.max(...shown.map((r) => r.revenue), 1);
  return (
    <ol className="space-y-3">
      {shown.map((row, index) => (
        <li key={row.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name ?? `#${row.id}`}</p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {t("live.topWorkers.jobs", { count: row.jobs })}
              {row.phone && <> · <a href={`tel:${row.phone}`} className="hover:text-foreground">{row.phone}</a></>}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatMoney(row.revenue, "UZS", true)}</p>
            {row.commission > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("live.topWorkers.commission", { amount: formatMoney(row.commission, "UZS", true) })}
              </p>
            )}
          </div>
          <div className="col-span-2 col-start-2 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(row.revenue / max) * 100}%`, background: "var(--series-7)" }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
