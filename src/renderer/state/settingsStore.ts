import { create } from "zustand";
import {
  applyAutoApiVersion,
  defaultSettings,
  type AppSettings
} from "@shared/types/settings";
import type { ApiKeyState } from "@shared/types/ipc";

const SETTINGS_AUTOSAVE_DELAY_MS = 150;

interface SettingsStoreState {
  settings: AppSettings;
  apiKeyState: ApiKeyState;
  loading: boolean;
  load: () => Promise<void>;
  save: () => Promise<void>;
  update: (updater: (draft: AppSettings) => AppSettings) => void;
  queueAutosave: () => void;
  flushAutosave: () => Promise<void>;
  setApiKey: (apiKey: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...createAutosaveController(set, get),
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
    await get().flushAutosave();
  },
  update(updater) {
    set((state) => {
      const settings = updater(structuredClone(state.settings));
      return { settings: applyAutoApiVersion(settings) };
    });
    get().queueAutosave();
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

function createAutosaveController(
  set: (partial: Partial<SettingsStoreState>) => void,
  get: () => SettingsStoreState
): Pick<SettingsStoreState, "queueAutosave" | "flushAutosave"> {
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveInFlight = false;
  let saveQueued = false;

  const persistLatest = async (): Promise<void> => {
    if (saveInFlight) {
      saveQueued = true;
      return;
    }

    saveInFlight = true;
    try {
      const settingsToSave = applyAutoApiVersion(structuredClone(get().settings));
      const settings = await window.appApi.settings.saveSettings(settingsToSave);
      set({ settings: applyAutoApiVersion(settings) });
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        await persistLatest();
      }
    }
  };

  return {
    queueAutosave() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
      }
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        void persistLatest();
      }, SETTINGS_AUTOSAVE_DELAY_MS);
    },
    async flushAutosave() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      await persistLatest();
    }
  };
}
