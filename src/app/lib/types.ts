// GET /api/stats/overview/ response (guds backend, docs/STATISTICS_API.md).

export type Comparison = "ok" | "previous_zero" | "no_change" | "unavailable" | "unsupported";

export interface Compared {
  value: number | null;
  previous: number | null;
  change: number | null;
  change_percent: number | null;
  comparison: Comparison;
}

export interface Bucket {
  bucket: string;
  date_from: string;
  date_to: string;
  partial: boolean;
}

export type FunnelStageKey = "otp_requested" | "otp_accepted" | "otp_delivered" | "otp_verified" | "otp_registered";

export interface FunnelStage extends Compared {
  stage: FunnelStageKey;
  conversion: number | null;
  basis: string | null;
}

export interface Funnel {
  stages: FunnelStage[];
  overall_conversion: number | null;
  accepted_without_delivery_reports: number;
}

export interface ObjectMetric extends Compared {
  app: string;
  label: string;
  kind: string;
}

export interface DimensionRow {
  registrations: Compared;
  share_percent: number | null;
}

export interface Overview {
  meta: {
    date_from: string;
    date_to: string;
    granularity: "day" | "week" | "month";
    timezone: string;
    filters: { country: string | null; registered_via: string | null; app: string | null };
    filters_applied: Record<"country" | "registered_via" | "app", string[]>;
    previous_period: { date_from: string; date_to: string };
    generated_at: string;
  };
  summary: {
    users: {
      new_registrations: Compared;
      total_users: Compared & { kind: string; note: string };
      deleted_accounts: Compared & { kind: string; tracked_since: string | null };
      inactive_accounts: { value: number; kind: string; note: string };
    };
    activity: {
      active_users: Compared;
      dau_average: Compared;
      wau: Compared;
      mau: Compared;
      tracking_since: string | null;
    };
    authentication: Funnel & {
      purpose: string;
      otp_requests_all_purposes: Compared;
      suppressed: Compared;
      sms_delivered_not_registered: Compared & {
        channel: string;
        admin_filters: Record<string, string>;
        admin_url: string | null;
      };
    };
    objects: Record<string, ObjectMetric>;
  };
  series: {
    registrations: (Bucket & { registrations: number; accounts_deleted: number; by_registered_via: Record<string, number> })[];
    activity: (Bucket & {
      dau?: number | null;
      wau?: number | null;
      mau?: number | null;
      active_users?: number | null;
      dau_average?: number | null;
    })[];
    authentication: (Bucket & Record<FunnelStageKey, number>)[];
    objects: (Bucket & Record<string, number>)[];
  };
  breakdowns: {
    country: (DimensionRow & { country: string })[];
    registered_via: (DimensionRow & { registered_via: string })[];
    app: { app: string; label: string; metrics: Record<string, Compared> }[];
    channel: (Funnel & { channel: string; delivery_confirmation: "supported" | "unsupported" })[];
  };
}
