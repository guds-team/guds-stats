// GET /api/stats/daily-works/jobs/ (guds backend, apps/statistics/jobs_report.py):
// daily works of a period — jobs per day, who did them, who ordered them.
// Filters live in the URL like the overview's: ?period=…&status=…&worker=…&client=…

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "./api";
import { parseFilters, presetRange, serializeFilters, type Preset } from "./filters";
import type { Person } from "./live";

export const JOB_REPORT_STATUSES = ["completed", "cancelled", "created"] as const;
export type JobReportStatus = (typeof JOB_REPORT_STATUSES)[number];

export interface PersonTotal extends Person {
  jobs: number;
  revenue: number;
}

export interface ReportJob {
  job_id: string;
  status: string;
  category: string;
  client: Person | null;
  worker: Person | null;
  price: number | null;
  currency: string;
  workers_count: number;
  address: string;
  at: string | null;
  created_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  worker_rating: number | null;
}

export interface JobsReport {
  meta: { date_from: string; date_to: string; status: JobReportStatus; worker: number | null; client: number | null; generated_at: string };
  totals: { jobs: number; revenue: number; commission: number; workers: number; clients: number };
  days: { day: string; jobs: number; revenue: number; workers: number; clients: number }[];
  workers: PersonTotal[];
  clients: PersonTotal[];
  jobs: ReportJob[];
  limits: { jobs: number; people: number };
}

export interface JobsFilters {
  period: Preset;
  date_from: string;
  date_to: string;
  status: JobReportStatus;
  worker: string; // user id, "" = everyone
  client: string;
}

function personId(value: string | null): string {
  return value && /^[1-9]\d{0,9}$/.test(value) ? value : "";
}

export function parseJobsFilters(params: URLSearchParams, today: string): JobsFilters {
  const { period, date_from, date_to } = parseFilters(params, today);
  const status = params.get("status");
  return {
    period,
    date_from,
    date_to,
    status: (JOB_REPORT_STATUSES as readonly string[]).includes(status ?? "") ? (status as JobReportStatus) : "completed",
    worker: personId(params.get("worker")),
    client: personId(params.get("client")),
  };
}

export function serializeJobsFilters(filters: JobsFilters): URLSearchParams {
  const params = serializeFilters({ period: filters.period, date_from: filters.date_from, date_to: filters.date_to,
    granularity: "day", country: "", registered_via: "", app: "" });
  if (filters.status !== "completed") params.set("status", filters.status);
  if (filters.worker) params.set("worker", filters.worker);
  if (filters.client) params.set("client", filters.client);
  return params;
}

export function jobsApiParams(filters: JobsFilters, today: string): Record<string, string> {
  const [date_from, date_to] = presetRange(filters.period, today, { from: filters.date_from, to: filters.date_to });
  return { date_from, date_to, status: filters.status, worker: filters.worker, client: filters.client };
}

export type JobsState =
  | { status: "loading"; data: JobsReport | null }
  | { status: "success"; data: JobsReport }
  | { status: "error"; error: ApiError | Error; data: JobsReport | null };

export function useJobsReport(params: Record<string, string>): JobsState & { retry: () => void } {
  const key = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const [state, setState] = useState<JobsState>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ status: "loading", data: prev.data })); // keep the previous rows on screen
    apiGet("/api/stats/daily-works/jobs/", Object.fromEntries(new URLSearchParams(key)))
      .then((response) => response.json())
      .then(
        (body: { data: JobsReport }) => active && setState({ status: "success", data: body.data }),
        (error: Error) => active && setState((prev) => ({ status: "error", error, data: prev.data })),
      );
    return () => {
      active = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
