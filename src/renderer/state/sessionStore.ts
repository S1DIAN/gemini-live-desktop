import { create } from "zustand";
import type { EffectiveSessionSnapshot, SessionStatus } from "@shared/types/live";

interface SessionStoreState {
  status: SessionStatus;
  sessionId?: string;
  reconnectCount: number;
  connectConfigLocked: boolean;
  waitingForInput: boolean;
  userSpeaking: boolean;
  modelSpeaking: boolean;
  playbackActive: boolean;
  lastError: string;
  effectiveConfig: EffectiveSessionSnapshot | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  micLevel: number;
  setStatus: (payload: Partial<SessionStoreState>) => void;
  setMicEnabled: (value: boolean) => void;
  setCameraEnabled: (value: boolean) => void;
  setScreenEnabled: (value: boolean) => void;
  setMicLevel: (value: number) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  status: "idle",
  sessionId: undefined,
  reconnectCount: 0,
  connectConfigLocked: false,
  waitingForInput: false,
  userSpeaking: false,
  modelSpeaking: false,
  playbackActive: false,
  lastError: "",
  effectiveConfig: null,
  micEnabled: false,
  cameraEnabled: false,
  screenEnabled: false,
  micLevel: 0,
  setStatus: (payload) => set(payload),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  setScreenEnabled: (screenEnabled) => set({ screenEnabled }),
  setMicLevel: (micLevel) => set({ micLevel })
}));
