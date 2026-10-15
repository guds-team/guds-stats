// Labels (Uzbek), good/bad direction and fixed series colours of everything
// the overview reports. Colours follow the entity, never its rank: a filter
// that removes a series never repaints the others.

import type { FunnelStageKey } from "./types";

export const PRESET_LABELS: Record<string, string> = {
  today: "Bugun",
  yesterday: "Kecha",
  last7: "Oxirgi 7 kun",
  last30: "Oxirgi 30 kun",
  this_month: "Shu oy",
  previous_month: "O'tgan oy",
  custom: "Boshqa oraliq",
};

export const GRANULARITY_LABELS: Record<string, string> = { day: "Kun", week: "Hafta", month: "Oy" };

export const METHOD_LABELS: Record<string, string> = {
  phone: "Telefon (SMS)",
  email: "Email",
  google: "Google",
  apple: "Apple",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  unknown: "Noma'lum",
};

export const APP_LABELS: Record<string, string> = {
  jobs: "Ish qidirish",
  daily_works: "Kunlik ishlar",
  messaging: "Chat va qo'ng'iroqlar",
  wallet: "Hamyon va to'lovlar",
};

export const OBJECT_LABELS: Record<string, string> = {
  vacancies_created: "Vakansiyalar",
  resumes_created: "Rezyumelar",
  job_applications_created: "Otkliklar",
  companies_created: "Kompaniyalar",
  dw_jobs_created: "Joylangan ishlar",
  dw_jobs_completed: "Bajarilgan ishlar",
  dw_jobs_cancelled: "Bekor qilingan ishlar",
  dw_workers_registered: "Ishchi profillari",
  chats_created: "Yangi chatlar",
  messages_sent: "Xabarlar",
  calls_started: "Qo'ng'iroqlar",
  payments_succeeded: "Tasdiqlangan to'lovlar",
  payments_failed: "Muvaffaqiyatsiz to'lovlar",
  payments_cancelled: "Bekor qilingan to'lovlar",
  admin_top_ups: "Admin to'ldirishlari",
};

export function objectLabel(key: string, fallback?: string): string {
  return OBJECT_LABELS[key] ?? fallback ?? key;
}

export const STAGE_LABELS: Record<FunnelStageKey, string> = {
  otp_requested: "OTP yuborildi",
  otp_accepted: "Provayder qabul qildi",
  otp_delivered: "Yetkazildi",
  otp_verified: "Kod kiritildi",
  otp_registered: "Ro'yxatdan o'tdi",
};

export const STAGE_HINTS: Record<FunnelStageKey, string> = {
  otp_requested: "Yaratilgan OTP so'rovlari (noma'lum raqamga yuborilmaganlar hisobga olinmaydi)",
  otp_accepted: "Provayder qabul qilgan — bu hali yetkazilgani emas",
  otp_delivered: "Provayderning yetkazish hisoboti (SMS, Telegram, WhatsApp); emailda hisobot yo'q",
  otp_verified: "To'g'ri kod kiritilgan; noto'g'ri, eskirgan va bloklangan kodlar hisoblanmaydi",
  otp_registered: "Aynan shu kodning tasdiq tokeni bilan akkaunt yaratilgan",
};

export const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  email: "Email",
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["uz"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string): string {
  if (!code || code === "unknown") return "Noma'lum";
  try {
    const name = regionNames?.of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
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
