import { useMemo } from "react";
import { useI18nStore } from "./store";
import { translations } from "./translations";

export function useI18n() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const copy = useMemo(() => translations[locale], [locale]);

  return { locale, setLocale, copy };
}
