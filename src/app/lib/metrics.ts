// Labels (in the interface language), good/bad direction and fixed series
// colours of everything the overview reports. Colours follow the entity,
// never its rank: a filter that removes a series never repaints the others.
//
// Labels come from the translation files. Only keys listed here are looked
// up there; anything else the API sends (a new method, app or metric) is
// shown as the API names it.

import i18n, { currentLanguage, LOCALES, type Language } from "./i18n";
import { APPS, GRANULARITIES, PRESETS, REGISTRATION_METHODS, type Granularity, type Preset } from "./filters";
import type { FunnelStageKey } from "./types";

function includes<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

export function presetLabel(preset: Preset): string {
  return includes(PRESETS, preset) ? i18n.t(`filters.presets.${preset}`) : preset;
}

export function granularityLabel(granularity: Granularity | string): string {
  return includes(GRANULARITIES, granularity) ? i18n.t(`filters.granularities.${granularity}`) : granularity;
}

export function methodLabel(method: string): string {
  return includes(REGISTRATION_METHODS, method) ? i18n.t(`labels.methods.${method}`) : method;
}

export function appLabel(app: string): string {
  return includes(APPS, app) ? i18n.t(`labels.apps.${app}`) : app;
}

export const OBJECT_KEYS = [
  "vacancies_created",
  "resumes_created",
  "job_applications_created",
  "companies_created",
  "dw_jobs_created",
  "dw_jobs_completed",
  "dw_jobs_cancelled",
  "dw_workers_registered",
  "chats_created",
  "messages_sent",
  "calls_started",
  "payments_succeeded",
  "payments_failed",
  "payments_cancelled",
  "admin_top_ups",
] as const;

export function objectLabel(key: string, fallback?: string): string {
  return includes(OBJECT_KEYS, key) ? i18n.t(`labels.objects.${key}`) : fallback ?? key;
}

export const STAGE_KEYS = ["otp_requested", "otp_accepted", "otp_delivered", "otp_verified", "otp_registered"] as const;

export function stageLabel(stage: FunnelStageKey): string {
  return includes(STAGE_KEYS, stage) ? i18n.t(`labels.stages.${stage}`) : stage;
}

export function stageHint(stage: FunnelStageKey): string {
  return includes(STAGE_KEYS, stage) ? i18n.t(`labels.stageHints.${stage}`) : "";
}

/** The API's `basis` of a stage conversion ("otp_accepted on channels with delivery reports" included). */
export function stageBasisLabel(basis: string): string {
  if (basis === "otp_accepted on channels with delivery reports") return i18n.t("labels.stageBasis.otp_accepted_with_reports");
  const stages = ["otp_requested", "otp_accepted", "otp_delivered", "otp_verified"] as const;
  return includes(stages, basis) ? i18n.t(`labels.stageBasis.${basis}`) : "";
}

const CHANNELS = ["sms", "telegram", "whatsapp", "email"] as const;

export function channelLabel(channel: string): string {
  return includes(CHANNELS, channel) ? i18n.t(`labels.channels.${channel}`) : channel;
}

const regionNames = new Map<Language, Intl.DisplayNames | null>();

function regionNamesFor(language: Language): Intl.DisplayNames | null {
  if (!regionNames.has(language)) {
    try {
      regionNames.set(language, new Intl.DisplayNames([LOCALES[language]], { type: "region" }));
    } catch {
      regionNames.set(language, null); // no Intl.DisplayNames: codes are shown as they are
    }
  }
  return regionNames.get(language)!;
}

/** "Oʻzbekiston (UZ)" / "Узбекистан (UZ)" / "Uzbekistan (UZ)"; anything that is not an ISO alpha-2 code stays as is. */
export function countryLabel(code: string, language: Language = currentLanguage()): string {
  if (!code || code === "unknown") return i18n.getFixedT(language)("common.unknown");
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  const region = code.toUpperCase();
  try {
    const name = regionNamesFor(language)?.of(region);
    return name && name !== region ? `${name} (${region})` : region;
  } catch {
    return region;
  }
}

/** Countries offered in the filter: the platform's markets first; any other code still works from a URL. */
export const COUNTRY_OPTIONS = ["UZ", "KZ", "KG", "TJ", "TM", "RU", "TR", "AE", "KR", "US", "unknown"];

// ── Series colours (CSS variables in styles/theme.css, light and dark) ──────

export const OTHER_COLOR = "var(--series-other)";

export function seriesColor(slot: number): string {
  return `var(--series-${(slot % 8) + 1})`;
}

/** Fixed slot per registration method; stacks are drawn in this order too. */
export const METHOD_ORDER = ["phone", "email", "google", "apple", "telegram", "whatsapp"];

export function methodColor(method: string): string {
  const slot = METHOD_ORDER.indexOf(method);
  return slot === -1 ? OTHER_COLOR : seriesColor(slot);
}

// ── Live daily works (ws/stats/live/) ───────────────────────────────────────

export const WORKER_STATE_ORDER = ["online_idle", "offer_pending", "on_job"] as const;

export function workerStateLabel(state: string): string {
  return includes(WORKER_STATE_ORDER, state) ? i18n.t(`labels.workerStates.${state}`) : state;
}

export function workerStateColor(state: string): string {
  const slot = (WORKER_STATE_ORDER as readonly string[]).indexOf(state);
  return slot === -1 ? OTHER_COLOR : seriesColor(slot);
}

/** The job's way from posting to the work being done. */
export const JOB_STATUS_ORDER = ["pending", "offered", "accepted", "en_route", "arrived", "in_progress"] as const;

export function jobStatusLabel(status: string): string {
  return includes(JOB_STATUS_ORDER, status) ? i18n.t(`labels.jobStatuses.${status}`) : status;
}

export function jobStatusColor(status: string): string {
  const slot = (JOB_STATUS_ORDER as readonly string[]).indexOf(status);
  return slot === -1 ? OTHER_COLOR : seriesColor(slot);
}
