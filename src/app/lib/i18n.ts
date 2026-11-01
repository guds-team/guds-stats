// Interface language: Uzbek (default), Russian, English. Translations are
// bundled (no request at startup) and the instance is ready synchronously,
// so the first render is already in the right language.
//
// Language choice, in order: an explicit choice saved in localStorage, the
// browser's preferred languages, Uzbek. Only an explicit choice is saved, so
// a visitor who never picked one keeps following their browser.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uz from "../../locales/uz.json";
import ru from "../../locales/ru.json";
import en from "../../locales/en.json";

export const LANGUAGES = ["uz", "ru", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "uz";
export const LANGUAGE_STORAGE_KEY = "guds-stats-language";

/** BCP 47 locale for Intl (dates, numbers, country names) per interface language. */
export const LOCALES: Record<Language, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof uz };
  }
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** "ru-RU" → "ru", "EN" → "en"; null for anything unsupported. */
export function toLanguage(tag: string | null | undefined): Language | null {
  const base = (tag ?? "").trim().split(/[-_]/)[0].toLowerCase();
  return isLanguage(base) ? base : null;
}

export function readStoredLanguage(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null; // storage unavailable (privacy mode): fall through to the browser
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

export function detectLanguage(
  stored: Language | null = readStoredLanguage(),
  preferred: readonly string[] = browserLanguages(),
): Language {
  if (stored) return stored;
  for (const tag of preferred) {
    const language = toLanguage(tag);
    if (language) return language;
  }
  return DEFAULT_LANGUAGE;
}

/** The active interface language, for code outside React components. */
export function currentLanguage(): Language {
  return toLanguage(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LANGUAGE;
}

export function currentLocale(): string {
  return LOCALES[currentLanguage()];
}

/** <html lang> and the tab title follow the interface language. */
function applyToDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLanguage();
  document.title = i18n.t("app.documentTitle");
}

/** The user's explicit choice: applied at once and remembered for the next visit. */
export async function setLanguage(language: Language): Promise<void> {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
  await i18n.changeLanguage(language);
}

i18n.on("languageChanged", applyToDocument);

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  nonExplicitSupportedLngs: false,
  load: "languageOnly",
  initAsync: false, // resources are bundled: ready before the first render
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false }, // React escapes
});

applyToDocument();

export default i18n;
