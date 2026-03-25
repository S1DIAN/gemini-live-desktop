import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SessionStatus } from "@shared/types/live";
import { hasLiveSession } from "@renderer/state/sessionStatus";
import { useI18n } from "@renderer/i18n/useI18n";
import {
  CameraIcon,
  MicIcon,
  ScreenIcon,
  SettingsIcon
} from "@renderer/components/ui/Icons";
import { ScreenPreview } from "@renderer/components/ScreenPreview";
import { CameraPreview } from "@renderer/components/CameraPreview";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { LIVE_PREBUILT_VOICE_NAMES } from "@shared/constants/liveSpeech";
import { VoicePreviewButton } from "@renderer/components/VoicePreviewButton";
import {
  THINKING_BUDGET_AUTO,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  THINKING_BUDGET_OFF
} from "@shared/types/settings";
import { Switch } from "@renderer/components/ui/Switch";

interface SourceOption {
  id: string;
  label: string;
}

interface SessionControlsProps {
  status: SessionStatus;
  connectConfigLocked: boolean;
  lastError: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  mediaControlsEnabled: boolean;
  previewEnabled: boolean;
  cameraSources: SourceOption[];
  screenSources: SourceOption[];
  screenPreviewRef: RefObject<HTMLVideoElement | null>;
  cameraPreviewRef: RefObject<HTMLVideoElement | null>;
  onConnect: () => Promise<void>;
  onPause: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleMic: () => Promise<void>;
  onStopCamera: () => Promise<void>;
  onStopScreen: () => Promise<void>;
  onStartCameraWithSource: (sourceId: string) => Promise<void>;
  onStartScreenWithSource: (sourceId: string) => Promise<void>;
  onError: (error: unknown) => void;
}

export function SessionControls(props: SessionControlsProps) {
  const { copy } = useI18n();
  const { settings, update } = useSettingsStore();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "connect" | "pause" | "disconnect" | "mic" | "camera" | "screen" | null
  >(null);
  const [openPicker, setOpenPicker] = useState<"camera" | "screen" | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const sessionActive = hasLiveSession(props.status);
  const pausedWithRetainedConfig =
    props.status === "disconnected" && props.connectConfigLocked;
  const connectSetupLocked = sessionActive || pausedWithRetainedConfig;
  const voiceOptions = useMemo(() => {
    const base = Array.from(LIVE_PREBUILT_VOICE_NAMES) as string[];
    if (base.includes(settings.api.voiceName)) {
      return base;
    }
    return [settings.api.voiceName, ...base];
  }, [settings.api.voiceName]);
  const thinkingEnabled = settings.api.thinkingMode !== "off";
  const customThinkingBudget = settings.api.thinkingMode === "custom";
  const thinkingLevelLocked = connectSetupLocked || !thinkingEnabled;
  const thinkingBudgetLocked = connectSetupLocked || !thinkingEnabled;
  const thinkingBudgetRangeLocked = connectSetupLocked || !customThinkingBudget;

  async function run(
    action: "connect" | "pause" | "disconnect" | "mic" | "camera" | "screen",
    task: () => Promise<void>
  ) {
    setBusy(true);
    setBusyAction(action);
    try {
      await task();
    } catch (error) {
      props.onError(error);
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!settingsPanelOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (settingsPanelRef.current?.contains(target)) {
        return;
      }
      if (settingsButtonRef.current?.contains(target)) {
        return;
      }
      setSettingsPanelOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [settingsPanelOpen]);

  function updateThinkingMode(next: "off" | "auto" | "custom"): void {
    update((draft) => {
      draft.api.thinkingMode = next;
      if (next === "off") {
        draft.api.thinkingBudget = THINKING_BUDGET_OFF;
      } else if (next === "auto") {
        draft.api.thinkingBudget = THINKING_BUDGET_AUTO;
      } else if (draft.api.thinkingBudget < THINKING_BUDGET_MIN) {
        draft.api.thinkingBudget = THINKING_BUDGET_MIN;
      }
      return draft;
    });
  }

  const connectLabel =
    busy && busyAction === "connect"
      ? copy.sessionControls.connecting
      : copy.sessionControls.connect;
  const pauseLabel =
    busy && busyAction === "pause"
      ? copy.sessionControls.pausing
      : copy.sessionControls.pause;
  const disconnectLabel =
    busy && busyAction === "disconnect"
      ? copy.sessionControls.disconnecting
      : copy.sessionControls.disconnect;

  return (
    <section className="session-dock">
      <div className="session-dock-status">
        <span className={`status-pill status-${props.status}`}>
          {copy.sessionControls.statuses[props.status]}
        </span>
      </div>

      <div className="session-dock-control-bar">
        <div className="session-dock-primary">
          {sessionActive ? (
            <>
              <button
                className={`dock-action-button ${busyAction === "pause" ? "button-pending" : "button-secondary"}`}
                disabled={busy}
                onClick={() => void run("pause", props.onPause)}
              >
                {pauseLabel}
              </button>
              <button
                className={`dock-action-button ${busyAction === "disconnect" ? "button-pending" : "button-primary"}`}
                disabled={busy}
                onClick={() => void run("disconnect", props.onDisconnect)}
              >
                {disconnectLabel}
              </button>
            </>
          ) : pausedWithRetainedConfig ? (
            <>
              <button
                className={`dock-action-button ${busyAction === "connect" ? "button-pending" : "button-primary"}`}
                disabled={busy}
                onClick={() => void run("connect", props.onConnect)}
              >
                {connectLabel}
              </button>
              <button
                className={`dock-action-button ${busyAction === "disconnect" ? "button-pending" : "button-secondary"}`}
                disabled={busy}
                onClick={() => void run("disconnect", props.onDisconnect)}
              >
                {disconnectLabel}
              </button>
            </>
          ) : (
            <button
              className={`dock-action-button dock-action-button-wide ${busyAction === "connect" ? "button-pending" : "button-primary"}`}
              disabled={busy}
              onClick={() => void run("connect", props.onConnect)}
            >
              {connectLabel}
            </button>
          )}
        </div>

        <div className="session-dock-actions">
          {props.previewEnabled ? (
            <div className="session-dock-floating-previews">
              <ScreenPreview
                ref={props.screenPreviewRef}
                compact
                active={props.screenEnabled}
              />
              <CameraPreview
                ref={props.cameraPreviewRef}
                compact
                active={props.cameraEnabled}
              />
            </div>
          ) : null}
          <button
            type="button"
            className={props.micEnabled ? "dock-icon-button active" : "dock-icon-button"}
            title={`Mic ${props.micEnabled ? copy.common.on : copy.common.off}`}
            disabled={busy || !props.mediaControlsEnabled}
            onClick={() => void run("mic", props.onToggleMic)}
          >
            <MicIcon size={15} />
          </button>

          <div className="dock-picker-wrap">
            <button
              type="button"
              className={props.cameraEnabled ? "dock-icon-button active" : "dock-icon-button"}
              title={`Camera ${props.cameraEnabled ? copy.common.on : copy.common.off}`}
              disabled={busy || !props.mediaControlsEnabled}
              onClick={() => {
                if (props.cameraEnabled) {
                  void run("camera", props.onStopCamera);
                  return;
                }
                setOpenPicker((current) => (current === "camera" ? null : "camera"));
              }}
            >
              <CameraIcon size={15} />
            </button>
            {openPicker === "camera" ? (
              <div className="dock-picker">
                {props.cameraSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className="dock-picker-item"
                    onClick={() => {
                      setOpenPicker(null);
                      void run("camera", () => props.onStartCameraWithSource(source.id));
                    }}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dock-picker-wrap">
            <button
              type="button"
              className={props.screenEnabled ? "dock-icon-button active" : "dock-icon-button"}
              title={`Screen ${props.screenEnabled ? copy.common.on : copy.common.off}`}
              disabled={busy || !props.mediaControlsEnabled}
              onClick={() => {
                if (props.screenEnabled) {
                  void run("screen", props.onStopScreen);
                  return;
                }
                setOpenPicker((current) => (current === "screen" ? null : "screen"));
              }}
            >
              <ScreenIcon size={15} />
            </button>
            {openPicker === "screen" ? (
              <div className="dock-picker">
                {props.screenSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className="dock-picker-item"
                    onClick={() => {
                      setOpenPicker(null);
                      void run("screen", () => props.onStartScreenWithSource(source.id));
                    }}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dock-picker-wrap dock-settings-wrap">
            <button
              ref={settingsButtonRef}
              type="button"
              className={settingsPanelOpen ? "dock-icon-button active" : "dock-icon-button"}
              title={copy.settings.title}
              onClick={() => {
                setOpenPicker(null);
                setSettingsPanelOpen((open) => !open);
              }}
            >
              <SettingsIcon size={15} />
            </button>
            <div
              ref={settingsPanelRef}
              className={`dock-ai-settings-panel ${settingsPanelOpen ? "open" : ""}`}
              role="dialog"
              aria-label={copy.settings.title}
              aria-hidden={!settingsPanelOpen}
            >
              <div
                className={`dock-ai-settings-section ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <label className="dock-ai-settings-label" htmlFor="dock-model-input">
                  {copy.settings.fields.model}
                </label>
                <input
                  id="dock-model-input"
                  disabled={connectSetupLocked}
                  value={settings.api.model}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.model = event.target.value;
                      return draft;
                    })
                  }
                />
              </div>

              <div
                className={`dock-ai-settings-section ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <label className="dock-ai-settings-label" htmlFor="dock-voice-select">
                  {copy.settings.fields.voice}
                </label>
                <select
                  id="dock-voice-select"
                  disabled={connectSetupLocked}
                  value={settings.api.voiceName}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.voiceName = event.target.value;
                      return draft;
                    })
                  }
                >
                  {voiceOptions.map((voiceName) => (
                    <option key={voiceName} value={voiceName}>
                      {voiceName}
                    </option>
                  ))}
                </select>
                <VoicePreviewButton
                  voiceName={settings.api.voiceName}
                  disabled={connectSetupLocked}
                  compact
                />
              </div>

              <div
                className={`dock-ai-settings-section ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <label
                  className="dock-ai-settings-label"
                  htmlFor="dock-media-resolution-select"
                >
                  {copy.settings.fields.mediaResolution}
                </label>
                <select
                  id="dock-media-resolution-select"
                  value={settings.visual.mediaResolution}
                  disabled={connectSetupLocked}
                  onChange={(event) =>
                    update((draft) => {
                      draft.visual.mediaResolution = event.target.value as
                        | "low"
                        | "medium"
                        | "high";
                      return draft;
                    })
                  }
                >
                  <option value="low">{copy.settings.options.mediaResolution.low}</option>
                  <option value="medium">
                    {copy.settings.options.mediaResolution.medium}
                  </option>
                  <option value="high">{copy.settings.options.mediaResolution.high}</option>
                </select>
              </div>

              <div
                className={`dock-ai-settings-section ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <label
                  className="dock-ai-settings-label"
                  htmlFor="dock-assistant-mode-select"
                >
                  {copy.callPage.assistantModeTitle}
                </label>
                <select
                  id="dock-assistant-mode-select"
                  disabled={connectSetupLocked}
                  value={settings.api.proactiveMode}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.proactiveMode = event.target.value as
                        | "off"
                        | "pure"
                        | "assisted";
                      return draft;
                    })
                  }
                >
                  <option value="off">{copy.settings.options.proactiveMode.off}</option>
                  <option value="pure">{copy.settings.options.proactiveMode.pure}</option>
                  <option value="assisted">
                    {copy.settings.options.proactiveMode.assisted}
                  </option>
                </select>
              </div>

              <div
                className={`dock-ai-settings-switch-row ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <span>{copy.settings.fields.allowInterruption}</span>
                <Switch
                  checked={settings.api.allowInterruption}
                  disabled={connectSetupLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.api.allowInterruption = next;
                      return draft;
                    })
                  }
                />
              </div>

              <div
                className={`dock-ai-settings-switch-row ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <span>{copy.settings.fields.thinkingMode}</span>
                <Switch
                  checked={thinkingEnabled}
                  disabled={connectSetupLocked}
                  onChange={(next) => updateThinkingMode(next ? "auto" : "off")}
                />
              </div>

              <div
                className={`dock-ai-settings-section ${thinkingLevelLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <label
                  className="dock-ai-settings-label"
                  htmlFor="dock-thinking-level-select"
                >
                  {copy.settings.fields.thinkingLevel}
                </label>
                <select
                  id="dock-thinking-level-select"
                  disabled={thinkingLevelLocked}
                  value={settings.api.thinkingLevel}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.thinkingLevel = event.target.value as
                        | "model_default"
                        | "minimal"
                        | "low"
                        | "medium"
                        | "high";
                      return draft;
                    })
                  }
                >
                  <option value="model_default">
                    {copy.settings.options.thinkingLevel.model_default}
                  </option>
                  <option value="minimal">
                    {copy.settings.options.thinkingLevel.minimal}
                  </option>
                  <option value="low">{copy.settings.options.thinkingLevel.low}</option>
                  <option value="medium">
                    {copy.settings.options.thinkingLevel.medium}
                  </option>
                  <option value="high">{copy.settings.options.thinkingLevel.high}</option>
                </select>
              </div>

              <div
                className={`dock-ai-settings-switch-row ${thinkingBudgetLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <span>{copy.settings.fields.thinkingBudget}</span>
                <Switch
                  checked={customThinkingBudget}
                  disabled={thinkingBudgetLocked}
                  onChange={(next) => updateThinkingMode(next ? "custom" : "auto")}
                />
              </div>

              <div
                className={`dock-ai-settings-range-row ${thinkingBudgetRangeLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <input
                  type="range"
                  min={THINKING_BUDGET_MIN}
                  max={THINKING_BUDGET_MAX}
                  step={1}
                  disabled={thinkingBudgetRangeLocked}
                  value={
                    customThinkingBudget
                      ? settings.api.thinkingBudget
                      : THINKING_BUDGET_MIN
                  }
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) {
                      return;
                    }
                    const clamped = Math.max(
                      THINKING_BUDGET_MIN,
                      Math.min(THINKING_BUDGET_MAX, Math.round(parsed))
                    );
                    update((draft) => {
                      draft.api.thinkingBudget = clamped;
                      return draft;
                    });
                  }}
                />
                <span className="value-pill">
                  {customThinkingBudget
                    ? settings.api.thinkingBudget
                    : settings.api.thinkingMode === "auto"
                      ? copy.settings.options.thinkingMode.auto
                      : copy.settings.options.thinkingMode.off}
                </span>
              </div>

              <div
                className={`dock-ai-settings-switch-row ${connectSetupLocked ? "dock-ai-settings-item-locked" : ""}`}
              >
                <span>{copy.settings.fields.affectiveDialog}</span>
                <Switch
                  checked={settings.api.enableAffectiveDialog}
                  disabled={connectSetupLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.api.enableAffectiveDialog = next;
                      return draft;
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
