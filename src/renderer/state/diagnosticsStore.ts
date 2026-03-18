import { create } from "zustand";
import type { DiagnosticsEvent } from "@shared/types/diagnostics";
import type { EffectiveRuntimeConfig } from "@shared/types/live";

interface DiagnosticsStoreState {
  events: DiagnosticsEvent[];
  effectiveConfig: EffectiveRuntimeConfig | null;
  append: (event: DiagnosticsEvent, persistToMain?: boolean) => void;
  setEffectiveConfig: (config: EffectiveRuntimeConfig | null) => void;
  loadInitial: () => Promise<void>;
}

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set) => ({
  events: [],
  effectiveConfig: null,
  append(event, persistToMain = true) {
    set((state) => {
      if (state.events.some((existing) => existing.id === event.id)) {
        return state;
      }
      return { events: [event, ...state.events].slice(0, 400) };
    });
    if (persistToMain) {
      void window.appApi.diagnostics.appendClientEvent(event).catch(() => undefined);
    }
  },
  setEffectiveConfig(effectiveConfig) {
    set({ effectiveConfig });
  },
  async loadInitial() {
    const [events, effectiveConfig] = await Promise.all([
      window.appApi.diagnostics.getRecentDiagnostics(),
      window.appApi.diagnostics.getEffectiveConfig()
    ]);
    set({ events, effectiveConfig });
  }
}));
