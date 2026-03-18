import { create } from "zustand";
import type { Locale } from "./translations";

const LOCALE_STORAGE_KEY = "gemini-live-desktop-locale";

function getStoredLocale(): Locale {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (value === "en" || value === "ru") {
      return value;
    }
  } catch {
    return "en";
  }
  return "en";
}

interface I18nStoreState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nStoreState>((set) => ({
  locale: getStoredLocale(),
  setLocale(locale) {
    set({ locale });
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      return;
    }
  }
}));
