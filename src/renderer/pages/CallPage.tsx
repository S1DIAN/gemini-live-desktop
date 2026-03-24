import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SessionControls } from "@renderer/components/SessionControls";
import { TranscriptPanel } from "@renderer/components/TranscriptPanel";
import { useSessionStore } from "@renderer/state/sessionStore";
import {
  areMediaControlsEnabled,
  isConnectionBusy
} from "@renderer/state/sessionStatus";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { useTranscriptStore } from "@renderer/state/transcriptStore";
import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { AudioInputController } from "@renderer/services/audio/audioInputController";
import { ScreenCaptureController } from "@renderer/services/media/screenCaptureController";
import { CameraCaptureController } from "@renderer/services/media/cameraCaptureController";
import { ProactiveOrchestrator } from "@renderer/services/live/proactiveOrchestrator";
import { proactivityMetricsTracker } from "@renderer/services/live/proactivityMetricsTracker";
import { liveClientAdapter } from "@renderer/services/live/liveClientAdapter";
import { useI18n } from "@renderer/i18n/useI18n";
import type { VoiceTurnTelemetryEvent } from "@shared/types/live";
import { PageHeader } from "@renderer/components/layout/PageHeader";
import type { DisplaySourceDescriptor } from "@shared/types/ipc";

const audioController = new AudioInputController();
const screenController = new ScreenCaptureController();
const cameraController = new CameraCaptureController();
const proactive = new ProactiveOrchestrator();

interface LocalVoiceTurnState {
  turnId: string;
  speechStartedAt: number;
  lastSpeechTimestamp: number;
  lastSpeechFrameIndex: number;
  audioChunksSent: number;
}

interface QuickDevicesState {
  cameras: MediaDeviceInfo[];
  displays: DisplaySourceDescriptor[];
}

export function CallPage() {
  const session = useSessionStore();
  const settingsStore = useSettingsStore();
  const { copy } = useI18n();
  const transcriptEntries = useTranscriptStore((state) => state.entries);
  const appendDiagnostic = useDiagnosticsStore((state) => state.append);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");
  const [quickDevices, setQuickDevices] = useState<QuickDevicesState>({
    cameras: [],
    displays: []
  });
  const [actionMessage, setActionMessage] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const chunkSequence = useRef(0);
  const frameSequence = useRef(0);
  const activeVoiceTurn = useRef<LocalVoiceTurnState | null>(null);

  const connectionBusy = useMemo(
    () => isConnectionBusy(session.status),
    [session.status]
  );
  const mediaControlsEnabled = useMemo(
    () => areMediaControlsEnabled(session.status),
    [session.status]
  );
  const orbIsIdle =
    session.status === "idle" || session.status === "disconnected" || session.status === "error";
  const orbIsConnecting = session.status === "connecting";
  const liveSessionActive =
    session.status === "connected" ||
    session.status === "reconnecting" ||
    session.status === "disconnecting";
  const orbIsSpeaking = session.modelSpeaking;
  const orbLevel = useMemo(() => {
    if (orbIsIdle) {
      return 0;
    }
    if (orbIsConnecting) {
      return 0.6;
    }
    if (orbIsSpeaking) {
      return 1;
    }
    if (session.playbackActive) {
      return 0.72;
    }
    if (session.userSpeaking) {
      return Math.max(0.24, Math.min(0.56, session.micLevel * 6.5));
    }
    if (session.micEnabled) {
      return Math.max(0.2, Math.min(0.46, session.micLevel * 5.4));
    }
    if (liveSessionActive) {
      return 0.28;
    }
    return 0;
  }, [
    orbIsConnecting,
    orbIsIdle,
    orbIsSpeaking,
    liveSessionActive,
    session.micEnabled,
    session.micLevel,
    session.playbackActive,
    session.userSpeaking
  ]);
  const orbStyle = useMemo(
    () =>
      ({
        "--orb-level": orbLevel.toFixed(3)
      }) as CSSProperties,
    [orbLevel]
  );

  useEffect(() => {
    void liveClientAdapter.setVolume(settingsStore.settings.audio.modelVolume);
  }, [settingsStore.settings.audio.modelVolume]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [mediaDevices, displays] = await Promise.all([
        navigator.mediaDevices.enumerateDevices(),
        window.appApi.media.listDisplaySources()
      ]);
      if (cancelled) {
        return;
      }
      setQuickDevices({
        cameras: mediaDevices.filter((item) => item.kind === "videoinput"),
        displays
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function stopAllLocalMedia(): Promise<void> {
    abortActiveVoiceTurn(
      "user_cancel",
      "capture",
      copy.callPage.messages.microphoneStopped
    );
    if (session.micEnabled) {
      emitMicStreamPaused("session_teardown");
    }
    await Promise.allSettled([
      audioController.stop(),
      screenController.stop(),
      cameraController.stop()
    ]);
    session.setMicEnabled(false);
    session.setScreenEnabled(false);
    session.setCameraEnabled(false);
  }

  useEffect(() => {
    if (
      session.status !== "idle" &&
      session.status !== "disconnected" &&
      session.status !== "error"
    ) {
      return;
    }

    void stopAllLocalMedia();
  }, [session.status]);

  useEffect(() => {
    if (!settingsStore.settings.visual.previewEnabled) {
      screenController.setPreviewElement(null);
      cameraController.setPreviewElement(null);
      return;
    }

    screenController.setPreviewElement(screenPreviewRef.current);
    cameraController.setPreviewElement(cameraPreviewRef.current);

    return () => {
      screenController.setPreviewElement(null);
      cameraController.setPreviewElement(null);
    };
  }, [settingsStore.settings.visual.previewEnabled]);

  function reportControlError(error: unknown): void {
    const details =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { value: String(error) };

    setActionMessage({
      tone: "error",
      text: error instanceof Error ? error.message : String(error)
    });
    session.setStatus({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error)
    });

    appendDiagnostic({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level: "error",
      category: "session",
      message: copy.callPage.messages.controlActionFailed,
      details
    });
  }

  function assertMediaSessionReady(action: string): void {
    if (mediaControlsEnabled) {
      return;
    }

    throw new Error(copy.callPage.messages.mediaSessionRequired(action));
  }

  async function handleTransportFailure(
    source: "microphone" | "screen" | "camera",
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const sourceLabel = copy.callPage.mediaSource[source];

    if (source === "microphone") {
      abortActiveVoiceTurn("mic_capture_failure", "capture", message);
      await audioController.stop();
      session.setMicEnabled(false);
    }

    if (source === "screen") {
      await screenController.stop();
      session.setScreenEnabled(false);
    }

    if (source === "camera") {
      await cameraController.stop();
      session.setCameraEnabled(false);
    }

    setActionMessage({
      tone: "error",
      text: copy.callPage.messages.transportFailed(sourceLabel, message)
    });
    appendDiagnostic({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level: "error",
      category: "media",
      message: copy.callPage.messages.transportFailedShort(sourceLabel),
      details: { message }
    });
  }

  function isDetachedTransportError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("transport port is not attached") ||
      message.includes("MessagePort") ||
      message.includes("closed")
    );
  }

  async function sendAudioChunkWithRecovery(
    chunk: Uint8Array,
    timestamp: number,
    turnId: string | undefined,
    frameIndex: number,
    volumeLevel: number
  ): Promise<void> {
    const sequence = chunkSequence.current++;
    const send = () =>
      window.appApi.live.sendAudioChunk(
        chunk,
        sequence,
        timestamp,
        turnId,
        frameIndex,
        volumeLevel
      );

    try {
      await send();
    } catch (error) {
      if (!isDetachedTransportError(error)) {
        throw error;
      }
      appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "warn",
        category: "media",
        message: "Audio transport detached, requesting new media ports",
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      await window.appApi.live.requestMediaTransport();
      await send();
    }
  }

  async function sendVisualFrameWithRecovery(
    bytes: Uint8Array,
    timestamp: number,
    width: number,
    height: number,
    stream: "screen" | "camera"
  ): Promise<void> {
    const sequence = frameSequence.current++;
    const send = () =>
      window.appApi.live.sendVisualFrame(
        bytes,
        sequence,
        timestamp,
        width,
        height,
        stream
      );

    try {
      await send();
    } catch (error) {
      if (!isDetachedTransportError(error)) {
        throw error;
      }
      appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "warn",
        category: "media",
        message: "Visual transport detached, requesting new media ports",
        details: {
          stream,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      await window.appApi.live.requestMediaTransport();
      await send();
    }
  }

  async function onConnect() {
    setActionMessage({
      tone: "info",
      text: copy.callPage.messages.connecting
    });
    session.setStatus({
      status: "connecting",
      lastError: ""
    });
    await settingsStore.save();
    const result = await liveClientAdapter.connect(false);
    if (!result.ok) {
      const errorText = result.reason ?? copy.callPage.messages.connectFailed;
      setActionMessage({
        tone: "error",
        text: errorText
      });
      session.setStatus({
        status: "error",
        lastError: errorText
      });
      appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "error",
        category: "session",
        message: copy.callPage.messages.connectFailed,
        details: { reason: result.reason }
      });
      return;
    }

    setActionMessage({
      tone: "success",
      text: copy.callPage.messages.connectedReady
    });
    session.setStatus({
      status: "connected",
      lastError: ""
    });
  }

  async function onPause() {
    setActionMessage({
      tone: "info",
      text: copy.callPage.messages.pausing
    });
    session.setStatus({
      status: "disconnecting",
      lastError: ""
    });
    let pauseError: unknown = null;
    try {
      await liveClientAdapter.disconnect("pause");
    } catch (error) {
      pauseError = error;
    }
    await stopAllLocalMedia();

    if (pauseError) {
      throw pauseError;
    }

    setActionMessage({
      tone: "success",
      text: copy.callPage.messages.paused
    });
    session.setStatus({
      status: "disconnected",
      lastError: ""
    });
  }

  async function onTerminate() {
    setActionMessage({
      tone: "info",
      text: copy.callPage.messages.disconnecting
    });
    session.setStatus({
      status: "disconnecting",
      lastError: ""
    });
    let disconnectError: unknown = null;
    try {
      await liveClientAdapter.disconnect("terminate");
    } catch (error) {
      disconnectError = error;
    }
    await stopAllLocalMedia();

    if (disconnectError) {
      throw disconnectError;
    }

    useTranscriptStore.getState().clear();
    setText("");
    setActionMessage({
      tone: "success",
      text: copy.callPage.messages.disconnectedReset
    });
    session.setStatus({
      status: "disconnected",
      lastError: ""
    });
  }

  async function onToggleMic() {
    if (session.micEnabled) {
      abortActiveVoiceTurn(
        "user_cancel",
        "capture",
        copy.callPage.messages.microphoneDisabled
      );
      emitMicStreamPaused("microphone_stopped");
      await audioController.stop();
      session.setMicEnabled(false);
      return;
    }

    assertMediaSessionReady(copy.callPage.actionNames.enableMicrophone);
    const vadSensitivity = settingsStore.settings.audio.detection.sensitivity;
    const vadSilenceDurationMs =
      settingsStore.settings.audio.detection.silenceDurationMs;
    const vadThreshold = toVadThreshold(vadSensitivity);
    const stream = await audioController.start(settingsStore.settings.audio.inputDeviceId, {
      onChunk: (chunk, timestamp, meta) => {
        let currentTurn = activeVoiceTurn.current;
        if (!currentTurn && meta.volumeLevel >= vadThreshold) {
          const turnId = crypto.randomUUID();
          currentTurn = {
            turnId,
            speechStartedAt: timestamp,
            lastSpeechTimestamp: timestamp,
            lastSpeechFrameIndex: meta.frameIndex,
            audioChunksSent: 0
          };
          activeVoiceTurn.current = currentTurn;
          emitVoiceTurnEvent({
            event: "mic_first_frame_captured",
            turnId,
            timestamp,
            frameIndex: meta.frameIndex,
            volumeLevel: meta.volumeLevel
          });
          emitVoiceTurnEvent({
            event: "vad_speech_started",
            turnId,
            timestamp,
            vadSensitivity,
            currentVolume: meta.volumeLevel,
            threshold: vadThreshold
          });
        }

        void sendAudioChunkWithRecovery(
          chunk,
          timestamp,
          currentTurn?.turnId,
          meta.frameIndex,
          meta.volumeLevel
        ).catch((error) => handleTransportFailure("microphone", error));

        if (!currentTurn) {
          return;
        }
        currentTurn.audioChunksSent += 1;

        if (meta.volumeLevel >= vadThreshold) {
          proactivityMetricsTracker.onUserAudio(timestamp);
          currentTurn.lastSpeechTimestamp = timestamp;
          currentTurn.lastSpeechFrameIndex = meta.frameIndex;
          return;
        }

        if (timestamp - currentTurn.lastSpeechTimestamp < vadSilenceDurationMs) {
          return;
        }

        const speechDurationMs = Math.max(
          0,
          currentTurn.lastSpeechTimestamp - currentTurn.speechStartedAt
        );
        emitVoiceTurnEvent({
          event: "vad_speech_ended",
          turnId: currentTurn.turnId,
          timestamp,
          silenceDurationMs: vadSilenceDurationMs,
          speechDurationMs
        });
        emitVoiceTurnEvent({
          event: "mic_last_frame_captured",
          turnId: currentTurn.turnId,
          timestamp: currentTurn.lastSpeechTimestamp,
          frameIndex: currentTurn.lastSpeechFrameIndex
        });
        emitVoiceTurnEvent({
          event: "user_turn_input_completed",
          turnId: currentTurn.turnId,
          timestamp,
          silenceDurationMs: vadSilenceDurationMs,
          speechDurationMs,
          frameIndex: currentTurn.lastSpeechFrameIndex
        });
        proactivityMetricsTracker.onUserTurn({
          timestamp,
          speechDurationMs,
          audioChunksSent: currentTurn.audioChunksSent,
          wasCommitted: true
        });
        activeVoiceTurn.current = null;
      },
      onLevel: (level) => session.setMicLevel(level),
      onEnded: () => {
        abortActiveVoiceTurn(
          "mic_capture_failure",
          "capture",
          "Microphone stream ended"
        );
        session.setMicEnabled(false);
        setActionMessage({
          tone: "error",
          text: copy.callPage.messages.transportFailed(
            copy.callPage.mediaSource.microphone,
            "Microphone stream ended unexpectedly"
          )
        });
        appendDiagnostic({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "error",
          category: "media",
          message: copy.callPage.messages.transportFailedShort(
            copy.callPage.mediaSource.microphone
          ),
          details: { message: "Microphone stream ended unexpectedly" }
        });
      }
    });
    activeVoiceTurn.current = null;
    const trackSettings = stream.getAudioTracks()[0]?.getSettings();
    emitVoiceTurnEvent({
      event: "mic_capture_started",
      timestamp: Date.now(),
      deviceId: settingsStore.settings.audio.inputDeviceId,
      sampleRate:
        typeof trackSettings?.sampleRate === "number"
          ? trackSettings.sampleRate
          : null,
      channelCount:
        typeof trackSettings?.channelCount === "number"
          ? trackSettings.channelCount
          : null
    });
    audioController.setMuted(settingsStore.settings.audio.microphoneMuted);
    session.setMicEnabled(true);
  }

  async function onToggleScreen() {
    if (session.screenEnabled) {
      await screenController.stop();
      session.setScreenEnabled(false);
      return;
    }

    assertMediaSessionReady(copy.callPage.actionNames.shareScreen);
    if (!settingsStore.settings.visual.screenSourceId) {
      setActionMessage({
        tone: "error",
        text: copy.callPage.messages.selectScreenFirst
      });
      appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "warn",
        category: "media",
        message: copy.callPage.messages.cannotStartScreenWithoutSource
      });
      return;
    }

    await screenController.start({
      sourceId: settingsStore.settings.visual.screenSourceId,
      frameIntervalMs: settingsStore.settings.visual.frameIntervalMs,
      jpegQuality: settingsStore.settings.visual.jpegQuality,
      previewElement: settingsStore.settings.visual.previewEnabled
        ? screenPreviewRef.current
        : null,
      onFrame: async (bytes, width, height, timestamp) => {
        try {
          await sendVisualFrameWithRecovery(
            bytes,
            timestamp,
            width,
            height,
            "screen"
          );
        } catch (error) {
          await handleTransportFailure("screen", error);
          throw error;
        }
      },
      onDiff: (score, frameTimestamp) => {
        const proactiveMode = settingsStore.settings.api.proactiveMode;
        const tunedThreshold = toEffectiveProactiveThreshold(
          proactiveMode,
          settingsStore.settings.visual.changeThreshold
        );
        const tunedMinIntervalMs = toEffectiveProactiveMinInterval(
          proactiveMode,
          settingsStore.settings.behavior.maxAutonomousCommentFrequencyMs
        );
        const decision = proactive.evaluate({
          proactiveMode,
          screenEnabled: true,
          sessionReady: session.status === "connected",
          waitingForInput: session.waitingForInput,
          userSpeaking: session.userSpeaking,
          modelSpeaking: session.modelSpeaking,
          playbackActive: session.playbackActive,
          reconnecting: session.status === "reconnecting",
          changeScore: score,
          threshold: tunedThreshold,
          minIntervalMs: tunedMinIntervalMs,
          allowCommentaryDuringSilenceOnly:
            settingsStore.settings.behavior.allowCommentaryDuringSilenceOnly,
          allowCommentaryWhileUserIdleOnly:
            settingsStore.settings.behavior.allowCommentaryWhileUserIdleOnly
        });
        proactivityMetricsTracker.onProactivityEvaluation({
          timestamp: Date.now(),
          decision,
          proactiveMode,
          screenEnabled: true,
          sessionReady: session.status === "connected",
          reconnecting: session.status === "reconnecting",
          waitingForInput: session.waitingForInput,
          userSpeaking: session.userSpeaking,
          modelSpeaking: session.modelSpeaking,
          playbackActive: session.playbackActive,
          changeScore: score,
          threshold: tunedThreshold,
          minIntervalMs: tunedMinIntervalMs,
          allowCommentaryWhileUserIdleOnly:
            settingsStore.settings.behavior.allowCommentaryWhileUserIdleOnly
        });

        if (
          settingsStore.settings.diagnostics.enableVerboseLogging ||
          decision === "SEND_HIDDEN_HINT"
        ) {
          appendDiagnostic({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            event: "proactive_orchestrator_decision",
            level: decision === "SEND_HIDDEN_HINT" ? "info" : "debug",
            category: "proactive",
            message: copy.callPage.messages.proactiveDecision,
            details: {
              decision,
              score,
              proactiveMode,
              threshold: tunedThreshold,
              minIntervalMs: tunedMinIntervalMs,
              userThreshold: settingsStore.settings.visual.changeThreshold,
              userMinIntervalMs:
                settingsStore.settings.behavior.maxAutonomousCommentFrequencyMs
            }
          });
        }

        if (decision === "SEND_HIDDEN_HINT") {
          const hintTimestamp = new Date(frameTimestamp).toISOString();
          void liveClientAdapter.sendTextMessage(
            [
              "Latest screen frame delivered.",
              `Frame timestamp: ${hintTimestamp}.`,
              "Comment only on clearly visible elements in this latest frame.",
              "If uncertain, ask a short clarifying question instead of guessing."
            ].join(" "),
            true,
            "proactive_hidden_hint"
          );
        }
      },
      onEnded: () => {
        session.setScreenEnabled(false);
        setActionMessage({
          tone: "info",
          text: copy.callPage.messages.screenEndedOutside
        });
        appendDiagnostic({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "warn",
          category: "media",
          message: copy.callPage.messages.screenRevoked
        });
      }
    });
    session.setScreenEnabled(true);
  }

  async function onToggleCamera() {
    if (session.cameraEnabled) {
      await cameraController.stop();
      session.setCameraEnabled(false);
      return;
    }

    assertMediaSessionReady(copy.callPage.actionNames.startCamera);
    await cameraController.start({
      deviceId: settingsStore.settings.visual.cameraDeviceId,
      frameIntervalMs: settingsStore.settings.visual.frameIntervalMs,
      jpegQuality: settingsStore.settings.visual.jpegQuality,
      previewElement: settingsStore.settings.visual.previewEnabled
        ? cameraPreviewRef.current
        : null,
      onFrame: (bytes, width, height, timestamp) => {
        void sendVisualFrameWithRecovery(
          bytes,
          timestamp,
          width,
          height,
          "camera"
        ).catch((error) => handleTransportFailure("camera", error));
      }
    });
    session.setCameraEnabled(true);
  }

  async function onStartCameraWithSource(sourceId: string) {
    settingsStore.update((draft) => {
      draft.visual.cameraDeviceId = sourceId;
      return draft;
    });
    await onToggleCamera();
  }

  async function onStartScreenWithSource(sourceId: string) {
    settingsStore.update((draft) => {
      draft.visual.screenSourceId = sourceId;
      return draft;
    });
    await onToggleScreen();
  }

  async function onSendText() {
    if (!text.trim()) {
      return;
    }

    await liveClientAdapter.sendTextMessage(text.trim(), false, "manual_user_text");
    setText("");
  }

  function emitVoiceTurnEvent(event: VoiceTurnTelemetryEvent): void {
    void window.appApi.live.sendVoiceTurnEvent(event).catch((error) => {
      appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "warn",
        category: "media",
        message: copy.callPage.messages.voiceTelemetryFailed,
        details: {
          event: event.event,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    });
  }

  function emitMicStreamPaused(
    reason: Extract<VoiceTurnTelemetryEvent, { event: "mic_stream_paused" }>["reason"]
  ): void {
    emitVoiceTurnEvent({
      event: "mic_stream_paused",
      timestamp: Date.now(),
      reason
    });
  }

  function abortActiveVoiceTurn(
    reasonCode: Extract<VoiceTurnTelemetryEvent, { event: "turn_aborted" }>["reasonCode"],
    stage: Extract<VoiceTurnTelemetryEvent, { event: "turn_aborted" }>["stage"],
    reasonDetails?: string
  ): void {
    const activeTurn = activeVoiceTurn.current;
    if (!activeTurn) {
      return;
    }
    emitVoiceTurnEvent({
      event: "turn_aborted",
      turnId: activeTurn.turnId,
      timestamp: Date.now(),
      reasonCode,
      reasonDetails,
      stage
    });
    activeVoiceTurn.current = null;
  }

  return (
    <section className="page call-page">
      <PageHeader title={copy.callPage.pageTitle} />

      {actionMessage?.tone === "error" ? (
        <div className={`feedback-banner feedback-${actionMessage.tone}`}>
          {actionMessage.text}
        </div>
      ) : null}

      <div className="call-workspace">
        <div className="call-main-column">
          <section className="call-voice-stage" aria-hidden="true">
            <div
              className={`voice-orb${liveSessionActive ? " is-live" : ""}${
                orbIsConnecting ? " is-connecting" : ""
              }${orbIsSpeaking ? " is-speaking" : ""}${orbIsIdle ? " is-idle" : ""}`}
              style={orbStyle}
            >
              <div className="voice-orb-bars">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </section>
          <TranscriptPanel
            entries={transcriptEntries}
            composer={
              <div className="transcript-composer">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={copy.callPage.manualTextPlaceholder}
                  disabled={connectionBusy}
                />
                <button
                  className="button-primary"
                  onClick={() => void onSendText()}
                  disabled={connectionBusy || text.trim().length === 0}
                >
                  {copy.callPage.sendText}
                </button>
              </div>
            }
          />
        </div>
      </div>

      <SessionControls
        status={session.status}
        connectConfigLocked={session.connectConfigLocked}
        lastError={session.lastError}
        micEnabled={session.micEnabled}
        cameraEnabled={session.cameraEnabled}
        screenEnabled={session.screenEnabled}
        mediaControlsEnabled={mediaControlsEnabled}
        previewEnabled={settingsStore.settings.visual.previewEnabled}
        cameraSources={quickDevices.cameras.map((device) => ({
          id: device.deviceId,
          label: device.label || device.deviceId
        }))}
        screenSources={quickDevices.displays.map((display) => ({
          id: display.id,
          label: `${copy.deviceSelectors.displayKind[display.kind]}: ${display.name}`
        }))}
        screenPreviewRef={screenPreviewRef}
        cameraPreviewRef={cameraPreviewRef}
        onConnect={onConnect}
        onPause={onPause}
        onDisconnect={onTerminate}
        onToggleMic={onToggleMic}
        onStopCamera={onToggleCamera}
        onStopScreen={onToggleScreen}
        onStartCameraWithSource={onStartCameraWithSource}
        onStartScreenWithSource={onStartScreenWithSource}
        onError={reportControlError}
      />
    </section>
  );
}

function toVadThreshold(sensitivity: number): number {
  return 0.005 + (1 - sensitivity) * 0.045;
}

function toEffectiveProactiveThreshold(
  mode: "off" | "pure" | "assisted",
  baseThreshold: number
): number {
  if (mode === "pure") {
    return clamp(baseThreshold * 0.5, 0.03, 1);
  }
  if (mode === "assisted") {
    return clamp(baseThreshold * 0.75, 0.05, 1);
  }
  return clamp(baseThreshold, 0, 1);
}

function toEffectiveProactiveMinInterval(
  mode: "off" | "pure" | "assisted",
  baseMinIntervalMs: number
): number {
  if (mode === "pure") {
    return clamp(Math.round(baseMinIntervalMs * 0.5), 1200, 600000);
  }
  if (mode === "assisted") {
    return clamp(Math.round(baseMinIntervalMs * 0.75), 1800, 600000);
  }
  return clamp(Math.round(baseMinIntervalMs), 1000, 600000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
