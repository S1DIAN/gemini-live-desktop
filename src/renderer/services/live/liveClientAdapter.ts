import { AudioOutputController } from "@renderer/services/audio/audioOutputController";
import { proactivityMetricsTracker } from "@renderer/services/live/proactivityMetricsTracker";
import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { useI18nStore } from "@renderer/i18n/store";
import { useSessionStore } from "@renderer/state/sessionStore";
import { useTranscriptStore } from "@renderer/state/transcriptStore";
import type { DisconnectMode } from "@shared/types/live";

class LiveClientAdapter {
  private unsubscribe: (() => void) | null = null;
  private output = new AudioOutputController();

  initialize(): void {
    if (this.unsubscribe) {
      return;
    }

    this.output.setPlaybackCallbacks({
      onPlaybackStarted: (payload) => {
        useSessionStore.getState().setStatus({ playbackActive: true });
        void window.appApi.live.sendVoiceTurnEvent({
          event: "playback_started",
          turnId: payload.turnId,
          timestamp: payload.timestamp,
          outputDevice: payload.outputDevice,
          bufferedAudioMs: payload.bufferedAudioMs
        });
      },
      onPlaybackFirstSampleRendered: (payload) => {
        void window.appApi.live.sendVoiceTurnEvent({
          event: "playback_first_sample_rendered",
          turnId: payload.turnId,
          timestamp: payload.timestamp,
          outputDevice: payload.outputDevice,
          bufferedAudioMs: payload.bufferedAudioMs
        });
      },
      onPlaybackCompleted: (payload) => {
        useSessionStore.getState().setStatus({ playbackActive: false });
        void window.appApi.live.sendVoiceTurnEvent({
          event: "playback_completed",
          turnId: payload.turnId,
          timestamp: payload.timestamp,
          playbackDurationMs: payload.playbackDurationMs
        });
      }
    });
    void this.output.initialize();
    this.unsubscribe = window.appApi.live.onWorkerEvent(async (event) => {
      if (event.type === "session-state") {
        proactivityMetricsTracker.onSessionState(event.payload);
        useSessionStore.getState().setStatus({
          status: event.payload.status,
          sessionId: event.payload.sessionId,
          reconnectCount: event.payload.reconnectCount,
          connectConfigLocked: event.payload.connectConfigLocked,
          waitingForInput: event.payload.waitingForInput,
          userSpeaking: event.payload.userSpeaking,
          modelSpeaking: event.payload.modelSpeaking,
          lastError: event.payload.lastError ?? "",
          effectiveConfig: event.payload.effectiveConfig ?? null
        });
        return;
      }

      if (event.type === "diagnostics") {
        proactivityMetricsTracker.onDiagnostics(event.payload);
        useDiagnosticsStore.getState().append(event.payload, false);
        return;
      }

      if (event.type === "transcript") {
        useTranscriptStore.getState().upsert(event.payload);
        return;
      }

      if (event.type === "effective-config") {
        useDiagnosticsStore.getState().setEffectiveConfig(event.payload);
        return;
      }

      if (event.type === "audio-output") {
        await this.output.enqueue(
          Uint8Array.from(event.payload.data),
          event.payload.mimeType,
          event.payload.turnId
        );
        return;
      }

      if (event.type === "playback-clear") {
        useSessionStore.getState().setStatus({ playbackActive: false });
        this.output.clear();
      }
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.output.setPlaybackCallbacks(null);
  }

  async connect(useMock = false): Promise<{ ok: boolean; reason?: string }> {
    await window.appApi.live.requestMediaTransport();
    const locale = useI18nStore.getState().locale;
    const speechLanguageCode = locale === "ru" ? "ru" : "en";
    return window.appApi.live.connect({ useMock, speechLanguageCode });
  }

  disconnect(mode: DisconnectMode = "pause"): Promise<void> {
    return window.appApi.live.disconnect(mode);
  }

  sendTextMessage(
    text: string,
    hidden = false,
    source: "manual_user_text" | "proactive_hidden_hint" | "startup_instruction" = "manual_user_text"
  ): Promise<void> {
    return window.appApi.live.sendTextMessage(text, hidden, source);
  }

  clearPlayback(): void {
    this.output.clear();
  }

  setOutputDevice(deviceId: string): Promise<void> {
    return this.output.setOutputDevice(deviceId);
  }

  setVolume(volume: number): Promise<void> {
    return this.output.setVolume(volume);
  }
}

export const liveClientAdapter = new LiveClientAdapter();
