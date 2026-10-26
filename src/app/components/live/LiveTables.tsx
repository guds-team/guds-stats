import { useMemo, useState } from "react";
import { BadgeCheck, MapPin, Search, Star } from "lucide-react";
import { DataTable, type Column } from "../stats/DataTable";
import { EmptyState } from "../stats/states";
import { formatMoney, formatNumber, formatSince } from "../../lib/format";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_ORDER,
  WORKER_STATE_LABELS,
  WORKER_STATE_ORDER,
  jobStatusColor,
  workerStateColor,
} from "../../lib/metrics";
import type { LiveJob, LiveWorker, Person } from "../../lib/live";

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function PersonCell({ person, empty = "—" }: { person: Person | null; empty?: string }) {
  if (!person) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{person.name ?? `#${person.id}`}</p>
      {person.phone && (
        <a href={`tel:${person.phone}`} className="text-xs text-muted-foreground tabular-nums hover:text-foreground">
          {person.phone}
        </a>
      )}
    </div>
  );
}

function MapLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat === null || lng === null) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      aria-label="Xaritada ochish"
    >
      <MapPin className="h-3.5 w-3.5" aria-hidden />
      Xarita
    </a>
  );
}

function Filters<T extends string>({
  query,
  onQuery,
  options,
  labels,
  colors,
  counts,
  active,
  onActive,
  placeholder,
}: {
  query: string;
  onQuery: (q: string) => void;
  options: readonly T[];
  labels: Record<string, string>;
  colors: (key: string) => string;
  counts: Record<string, number>;
  active: T | null;
  onActive: (key: T | null) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="Holat bo'yicha" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={active === null}
          onClick={() => onActive(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            active === null ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
          }`}
        >
          Hammasi
        </button>
        {options.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={active === key}
            onClick={() => onActive(active === key ? null : key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active === key ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors(key) }} aria-hidden />
            {labels[key]}
            <span className="tabular-nums opacity-70">{formatNumber(counts[key] ?? 0)}</span>
          </button>
        ))}
      </div>
      <label className="relative block lg:w-72">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-full border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
    </div>
  );
}

function ago(iso: string, now: number): string {
  const since = formatSince(iso, now);
  return since === "hozirgina" ? since : `${since} oldin`;
}

const PAGE_SIZE = 20;

function matches(query: string, ...values: (string | number | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1;
  return counts;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export function WorkersTable({ workers, now, limit, total }: { workers: LiveWorker[]; now: number; limit: number; total: number }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<(typeof WORKER_STATE_ORDER)[number] | null>(null);
  const counts = useMemo(() => countBy(workers, (w) => w.state), [workers]);
  const rows = workers.filter(
    (w) => (!state || w.state === state) && matches(query, w.name, w.phone, w.id, w.current_job_id, ...w.categories),
  );
  const columns: Column<LiveWorker>[] = [
    {
      key: "worker",
      header: "Ishchi",
      sort: (w) => w.name ?? "",
      cell: (w) => (
        <div className="flex items-center gap-1.5">
          <PersonCell person={w} />
          {w.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-[color:var(--series-1)]" aria-label="Tasdiqlangan" />}
        </div>
      ),
    },
    {
      key: "state",
      header: "Holat",
      sort: (w) => WORKER_STATE_ORDER.indexOf(w.state),
      cell: (w) => <StatusPill label={WORKER_STATE_LABELS[w.state] ?? w.state} color={workerStateColor(w.state)} />,
    },
    {
      key: "categories",
      header: "Kategoriyalar",
      className: "hidden md:table-cell",
      cell: (w) => (
        <p className="max-w-56 truncate text-muted-foreground" title={w.categories.join(", ")}>
          {w.categories.join(", ") || "—"}
        </p>
      ),
    },
    {
      key: "rating",
      header: "Reyting",
      numeric: true,
      className: "hidden lg:table-cell",
      sort: (w) => w.rating,
      cell: (w) =>
        w.rating !== null ? (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-current text-[color:var(--series-4)]" aria-hidden />
            {w.rating.toFixed(2)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "jobs",
      header: "Bajargan",
      numeric: true,
      className: "hidden lg:table-cell",
      sort: (w) => w.total_jobs,
      cell: (w) => formatNumber(w.total_jobs),
    },
    {
      key: "online",
      header: "Onlayn",
      numeric: true,
      // Sorted "descending" = longest online first.
      sort: (w) => {
        const since = time(w.online_since);
        return since === null ? null : now - since;
      },
      cell: (w) => formatSince(w.online_since, now),
    },
    {
      key: "job",
      header: "Joriy ish",
      className: "hidden md:table-cell",
      cell: (w) => <span className="font-mono text-xs">{w.current_job_id ?? <span className="text-muted-foreground">—</span>}</span>,
    },
    { key: "map", header: "Joylashuv", className: "hidden sm:table-cell", cell: (w) => <MapLink lat={w.lat} lng={w.lng} /> },
  ];
  return (
    <div className="space-y-4">
      <Filters
        query={query}
        onQuery={setQuery}
        options={WORKER_STATE_ORDER}
        labels={WORKER_STATE_LABELS}
        colors={workerStateColor}
        counts={counts}
        active={state}
        onActive={setState}
        placeholder="Ism, telefon, kategoriya…"
      />
      {rows.length === 0 ? (
        workers.length ? (
          <EmptyState hint="Qidiruv yoki holat filtrini o'zgartiring">Filtr bo'yicha ishchi topilmadi</EmptyState>
        ) : (
          <EmptyState hint="Ishchilar ilovada onlayn bo'lganda shu yerda paydo bo'ladi">Hozir onlayn ishchi yo'q</EmptyState>
        )
      ) : (
        <DataTable caption="Onlayn ishchilar" columns={columns} rows={rows} pageSize={PAGE_SIZE} rowKey={(w) => w.id} />
      )}
      {total > limit && (
        <p className="text-xs text-muted-foreground">
          Jadvalda {formatNumber(limit)} ta ishchi ko'rsatildi, jami onlayn: {formatNumber(total)}.
        </p>
      )}
    </div>
  );
}

export function JobsTable({ jobs, now, limit, total }: { jobs: LiveJob[]; now: number; limit: number; total: number }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof JOB_STATUS_ORDER)[number] | null>(null);
  const counts = useMemo(() => countBy(jobs, (j) => j.status), [jobs]);
  const rows = jobs.filter(
    (j) =>
      (!status || j.status === status) &&
      matches(query, j.job_id, j.category, j.address, j.client?.name, j.client?.phone, j.worker?.name, j.worker?.phone),
  );
  const columns: Column<LiveJob>[] = [
    {
      key: "job",
      header: "Ish",
      sort: (j) => j.category,
      cell: (j) => (
        <div>
          <p className="font-medium">{j.category}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {j.job_id}
            {j.workers_count > 1 && ` · ${j.workers_count} ishchi`}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Holat",
      sort: (j) => JOB_STATUS_ORDER.indexOf(j.status),
      cell: (j) => <StatusPill label={JOB_STATUS_LABELS[j.status] ?? j.status} color={jobStatusColor(j.status)} />,
    },
    { key: "client", header: "Mijoz", className: "hidden md:table-cell", cell: (j) => <PersonCell person={j.client} /> },
    {
      key: "worker",
      header: "Ishchi",
      className: "hidden md:table-cell",
      cell: (j) => <PersonCell person={j.worker} empty="Tayinlanmagan" />,
    },
    { key: "price", header: "Narx", numeric: true, sort: (j) => j.price, cell: (j) => formatMoney(j.price, j.currency) },
    {
      key: "address",
      header: "Manzil",
      className: "hidden lg:table-cell",
      cell: (j) => (
        <div className="max-w-64">
          <p className="truncate" title={j.address}>
            {j.address}
          </p>
          <MapLink lat={j.lat} lng={j.lng} />
        </div>
      ),
    },
    {
      key: "created",
      header: "Joylangan",
      numeric: true,
      sort: (j) => time(j.created_at),
      cell: (j) => <span className="text-muted-foreground">{ago(j.created_at, now)}</span>,
    },
  ];
  return (
    <div className="space-y-4">
      <Filters
        query={query}
        onQuery={setQuery}
        options={JOB_STATUS_ORDER}
        labels={JOB_STATUS_LABELS}
        colors={jobStatusColor}
        counts={counts}
        active={status}
        onActive={setStatus}
        placeholder="ID, manzil, mijoz, ishchi…"
      />
      {rows.length === 0 ? (
        jobs.length ? (
          <EmptyState hint="Qidiruv yoki holat filtrini o'zgartiring">Filtr bo'yicha ish topilmadi</EmptyState>
        ) : (
          <EmptyState hint={null}>Hozir faol ish yo'q</EmptyState>
        )
      ) : (
        <DataTable caption="Faol ishlar" columns={columns} rows={rows} pageSize={PAGE_SIZE} rowKey={(j) => j.job_id} />
      )}
      {total > limit && (
        <p className="text-xs text-muted-foreground">
          Jadvalda oxirgi {formatNumber(limit)} ta ish ko'rsatildi, jami faol: {formatNumber(total)}.
        </p>
      )}
    </div>
  );
}
