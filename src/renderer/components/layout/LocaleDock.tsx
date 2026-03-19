import { useI18n } from "@renderer/i18n/useI18n";

export function LocaleDock() {
  const { locale, setLocale, copy } = useI18n();

  return (
    <div className="locale-dock" aria-label={copy.app.language.label}>
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => setLocale("en")}
      >
        {copy.app.language.english}
      </button>
      <button
        type="button"
        className={locale === "ru" ? "active" : ""}
        onClick={() => setLocale("ru")}
      >
        {copy.app.language.russian}
      </button>
    </div>
  );
}
