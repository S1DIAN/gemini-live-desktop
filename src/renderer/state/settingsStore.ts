import { create } from "zustand";
import {
  applyAutoApiVersion,
  defaultSettings,
  type AppSettings
} from "@shared/types/settings";
import type { ApiKeyState } from "@shared/types/ipc";

interface SettingsStoreState {
  settings: AppSettings;
  apiKeyState: ApiKeyState;
  loading: boolean;
  load: () => Promise<void>;
  save: () => Promise<void>;
  update: (updater: (draft: AppSettings) => AppSettings) => void;
  setApiKey: (apiKey: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: defaultSettings,
  apiKeyState: { hasKey: false, maskedLabel: "" },
  loading: false,
  async load() {
    set({ loading: true });
    const [settings, apiKeyState] = await Promise.all([
      window.appApi.settings.loadSettings(),
      window.appApi.settings.getApiKeyState()
    ]);
    set({ settings: applyAutoApiVersion(settings), apiKeyState, loading: false });
  },
  async save() {
    const settingsToSave = applyAutoApiVersion(structuredClone(get().settings));
    const settings = await window.appApi.settings.saveSettings(settingsToSave);
    set({ settings: applyAutoApiVersion(settings) });
  },
  update(updater) {
    set((state) => {
      const settings = updater(structuredClone(state.settings));
      return { settings: applyAutoApiVersion(settings) };
    });
  },
  async setApiKey(apiKey: string) {
    const apiKeyState = await window.appApi.settings.saveApiKey({ apiKey });
    set({ apiKeyState });
  },
  async clearApiKey() {
    const apiKeyState = await window.appApi.settings.clearApiKey();
    set({ apiKeyState });
  }
}));
