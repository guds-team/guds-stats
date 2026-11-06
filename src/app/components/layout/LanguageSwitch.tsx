import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage, toLanguage, DEFAULT_LANGUAGE } from "../../lib/i18n";

/**
 * UZ / RU / EN, next to the theme switch. Switching re-renders in place: the
 * route, the filters in the URL and anything typed on the page stay as they are.
 */
export function LanguageSwitch({ vertical = false, className = "" }: { vertical?: boolean; className?: string }) {
  const { t, i18n } = useTranslation();
  const active = toLanguage(i18n.resolvedLanguage) ?? DEFAULT_LANGUAGE;
  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={`flex items-center rounded-lg border bg-background p-0.5 ${vertical ? "flex-col" : ""} ${className}`}
    >
      {LANGUAGES.map((language) => {
        const name = t(`language.names.${language}`);
        return (
          <button
            key={language}
            type="button"
            lang={language}
            title={name}
            aria-label={name}
            aria-pressed={active === language}
            onClick={() => void setLanguage(language)}
            className={`grid h-7 flex-1 place-items-center rounded-md px-2 text-[11px] font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              active === language ? "bg-muted text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {language.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
