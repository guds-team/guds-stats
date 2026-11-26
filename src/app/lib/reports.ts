// Module reports of the guds backend (apps/statistics/reports/):
//   GET /api/stats/finance/              — revenue, top-ups, providers, wallets, top spenders
//   GET /api/stats/daily-works/summary/  — completion, cancellations, categories, ratings
//   GET /api/stats/employment/           — vacancies, recruitment funnel, salaries, companies
//   GET /api/stats/marketplace/?market=  — orders, GMV, purchase funnel, leaderboards
// Every report takes date_from / date_to (inclusive, Asia/Tashkent) and granularity.

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "./api";
import type { Bucket, Compared } from "./types";

export const REPORT_PATHS = {
  finance: "/api/stats/finance/",
  dailyWorks: "/api/stats/daily-works/summary/",
  employment: "/api/stats/employment/",
  marketplace: "/api/stats/marketplace/",
} as const;

export const MARKETS = ["marketplace", "food"] as const;
export type MarketName = (typeof MARKETS)[number];

export interface ReportMeta {
  date_from: string;
  date_to: string;
  granularity: "day" | "week" | "month";
  timezone: string;
  currency: string;
  previous_period: { date_from: string; date_to: string };
  generated_at: string;
  /** Metrics the backend has no source for yet. */
  unavailable?: string[];
}

export type SeriesPoint<K extends string> = Bucket & Record<K, number>;

export interface FunnelStep {
  stage: string;
  value: number | null;
  conversion: number | null;
}

// ── Finance ──────────────────────────────────────────────────────────────────

export interface FinanceReport {
  meta: ReportMeta;
  summary: Record<
    | "revenue" | "commission" | "refunds" | "refund_count" | "spending" | "charges" | "top_ups" | "top_up_count"
    | "failed_payments" | "admin_top_ups" | "net_revenue" | "average_top_up" | "paying_users" | "active_users"
    | "paying_share" | "arpu" | "arppu",
    Compared
  >;
  series: SeriesPoint<"revenue" | "commission" | "refunds" | "top_ups" | "top_up_count" | "failed_payments">[];
  breakdowns: {
    module: { module: string; revenue: Compared; charged: number; charges: number; share_percent: number | null; monetized: boolean }[];
    provider: {
      provider: string;
      succeeded: number;
      amount: number;
      failed: number;
      cancelled: number;
      pending: number;
      success_rate: number | null;
      average_processing_seconds: number | null;
    }[];
  };
  wallets: {
    total_balance: number;
    wallets: number;
    funded_wallets: number;
    negative_wallets: number;
    negative_balance_total: number;
    adjustments: { count: number; added: number; removed: number };
  };
  leaders: {
    user_id: number;
    name: string | null;
    phone: string | null;
    company: string | null;
    account_type: "user" | "company";
    spent: number;
    platform_revenue: number;
    transactions: number;
    commission: number;
    last_transaction_at: string | null;
  }[];
}

// ── Daily works ──────────────────────────────────────────────────────────────

export interface DailyWorksReport {
  meta: ReportMeta & { min_ratings: number };
  summary: Record<
    | "published" | "unassigned" | "assignment_seconds" | "completed" | "volume" | "commission" | "average_price"
    | "duration_seconds" | "average_rating" | "cancelled" | "cancelled_value" | "worker_earnings" | "completion_rate",
    Compared
  >;
  now: Record<"open_jobs" | "searching" | "in_progress" | "workers_online" | "workers_on_job" | "workers_verified" | "workers_total", number>;
  cohort: { status: string; jobs: number; share_percent: number | null }[];
  series: SeriesPoint<"published" | "completed" | "cancelled" | "volume" | "commission">[];
  cancellations: {
    by_side: { side: string; jobs: number; share_percent: number | null; value: number; after_assignment: number }[];
    reasons: { reason: string; jobs: number }[];
    series: SeriesPoint<"client" | "worker" | "system" | "other">[];
  };
  categories: {
    category_id: number;
    category: string | null;
    jobs: number;
    completed: number;
    cancelled: number;
    unassigned: number;
    average_price: number | null;
    workers: number;
    workers_online: number;
    jobs_per_worker: number | null;
  }[];
  top_rated_workers: {
    user_id: number;
    name: string | null;
    phone: string | null;
    rating: number;
    ratings: number;
    completed_jobs: number;
    verified: boolean;
  }[];
}

// ── Employment ───────────────────────────────────────────────────────────────

export interface EmploymentReport {
  meta: ReportMeta;
  stock: {
    vacancies: number;
    vacancies_by_status: Record<string, number>;
    active_vacancies: number;
    closed_vacancies: number;
    resumes: number;
    job_seekers: number;
    companies: number;
    active_companies: number;
    applications: number;
  };
  summary: Record<"vacancies_created" | "resumes_created" | "companies_created" | "applications" | "vacancy_views" | "hires", Compared>;
  series: SeriesPoint<"vacancies_created" | "applications" | "resumes_created" | "companies_created" | "vacancy_views">[];
  funnel: {
    stages: FunnelStep[];
    overall_conversion: number | null;
    unanswered_applications: number;
    unanswered_share: number | null;
    applications_per_vacancy: number | null;
    average_response_seconds: number | null;
    responded: number;
  };
  salaries: Record<"by_region" | "by_specialization", { name: string | null; currency: string; vacancies: number; average: number }[]>;
  demand_supply: { specialization: string; vacancies: number; resumes: number; resumes_per_vacancy: number | null }[];
  skills: { skill: string; vacancies: number }[];
  companies: {
    company_id: number;
    name: string;
    verified: boolean;
    active_vacancies: number;
    applications: number;
    hires: number;
    unanswered: number;
    average_response_seconds: number | null;
    rating: number | null;
  }[];
}

// ── Marketplace / food ───────────────────────────────────────────────────────

export interface MarketplaceReport {
  meta: ReportMeta & { market: MarketName };
  summary: Record<
    | "completed" | "gmv" | "buyers" | "sellers" | "fulfilment_seconds" | "delivery_seconds" | "placed" | "placed_value"
    | "cancelled" | "average_order_value" | "cancellation_rate" | "repeat_customer_rate" | "new_sellers",
    Compared
  >;
  stock: {
    products: number;
    active_products: number;
    active_sellers: number;
    open_orders: Record<string, number>;
    needs_admin_review: number;
    active_delivery_trips?: number;
    active_couriers?: number;
  };
  cohort: { status: string; orders: number; share_percent: number | null }[];
  series: SeriesPoint<"placed" | "completed" | "cancelled" | "gmv">[];
  cancellations: {
    by_side: { side: string; orders: number; share_percent: number | null }[];
    reasons: { reason: string; orders: number }[];
    after_delivery_started: number;
    value: number;
  };
  funnel: { unit: "buyers"; stages: FunnelStep[]; abandoned_carts: number; cart_abandonment_rate: number | null };
  top_products: {
    listing_id: number;
    title: string | null;
    image: string | null;
    seller_id: number;
    seller: string | null;
    units: number;
    orders: number;
    revenue: number;
    rating: number | null;
  }[];
  top_sellers: {
    seller_id: number;
    name: string | null;
    phone: string | null;
    orders: number;
    buyers: number;
    sales: number;
    cancelled_by_seller: number;
    rating: number | null;
    complaints: number | null;
  }[];
}

// ── Fetching ─────────────────────────────────────────────────────────────────

export type ReportState<T> =
  | { status: "loading"; data: T | null }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError | Error; data: T | null };

/** One report; the previous rows stay on screen while new parameters load. */
export function useReport<T>(path: string, params: Record<string, string>): ReportState<T> & { retry: () => void } {
  const key = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const [state, setState] = useState<ReportState<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ status: "loading", data: prev.data }));
    apiGet(path, Object.fromEntries(new URLSearchParams(key)))
      .then((response) => response.json())
      .then(
        (body: { data: T }) => active && setState({ status: "success", data: body.data }),
        (error: Error) => active && setState((prev) => ({ status: "error", error, data: prev.data })),
      );
    return () => {
      active = false;
    };
  }, [path, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** A plain value (stock) shown on a MetricCard, which has no comparison. */
export function stockMetric(value: number | null): Compared {
  return { value, previous: null, change: null, change_percent: null, comparison: "unavailable" };
}
