import { useMemo, useState } from "react";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { useSessionStore } from "@renderer/state/sessionStore";
import { hasLiveSession } from "@renderer/state/sessionStatus";
import { useI18n } from "@renderer/i18n/useI18n";
import { LIVE_PREBUILT_VOICE_NAMES } from "@shared/constants/liveSpeech";
import {
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  type ThinkingMode
} from "@shared/types/settings";
import { PageHeader } from "@renderer/components/layout/PageHeader";
import { SectionCard } from "@renderer/components/layout/SectionCard";
import { SettingsRow } from "@renderer/components/layout/SettingsRow";
import { Switch } from "@renderer/components/ui/Switch";
import { VoicePreviewButton } from "@renderer/components/VoicePreviewButton";

type SettingsSectionKey = "api" | "audio" | "visual" | "behavior" | "diagnostics";

export function SettingsPage() {
  const { settings, update, apiKeyState, setApiKey, clearApiKey } =
    useSettingsStore();
  const { copy } = useI18n();
  const sessionStatus = useSessionStore((state) => state.status);
  const retainedSessionLock = useSessionStore(
    (state) => state.connectConfigLocked
  );
  const sessionConfigLocked =
    hasLiveSession(sessionStatus) || retainedSessionLock;
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("api");
  const settingsCopy = copy.settings;

  const voiceOptions = useMemo(() => {
    const base = Array.from(LIVE_PREBUILT_VOICE_NAMES) as string[];
    if (base.includes(settings.api.voiceName)) {
      return base;
    }
    return [settings.api.voiceName, ...base];
  }, [settings.api.voiceName]);

  const tabs: { key: SettingsSectionKey; label: string }[] = [
    { key: "api", label: settingsCopy.sections.api },
    { key: "audio", label: settingsCopy.sections.audio },
    { key: "visual", label: settingsCopy.sections.visual },
    { key: "behavior", label: settingsCopy.sections.behavior },
    { key: "diagnostics", label: settingsCopy.sections.diagnostics }
  ];

  const setJpegQuality = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(1, Math.max(0.1, parsed));
    update((draft) => {
      draft.visual.jpegQuality = clamped;
      return draft;
    });
  };

  const setChangeThreshold = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(1, Math.max(0, parsed));
    update((draft) => {
      draft.visual.changeThreshold = clamped;
      return draft;
    });
  };

  return (
    <section className="page settings-page">
      <PageHeader
        title={settingsCopy.title}
        subtitle="One focused section at a time. No long scrolling setup screen."
        meta="Workspace"
      />

      {sessionConfigLocked ? (
        <div className="feedback-banner feedback-info settings-lock-banner">
          {settingsCopy.lockBanner}
        </div>
      ) : null}

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeSection === tab.key ? "active" : ""}
            onClick={() => setActiveSection(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === "api" ? (
        <SectionCard
          title={settingsCopy.sections.api}
          description="Secure key storage, model selection and connect-time voice setup."
        >
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.savedKey}
              description={apiKeyState.maskedLabel || settingsCopy.fields.noKeySaved}
              control={
                <div className="control-cluster">
                  <input
                    value={apiKeyState.maskedLabel}
                    readOnly
                    placeholder={settingsCopy.fields.noKeySaved}
                  />
                  <button
                    className="button-secondary"
                    disabled={sessionConfigLocked}
                    onClick={() => void clearApiKey()}
                  >
                    {settingsCopy.fields.deleteKey}
                  </button>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.newKey}
              description={settingsCopy.fields.pasteApiKey}
              control={
                <div className="control-cluster">
                  <input
                    disabled={sessionConfigLocked}
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    placeholder={settingsCopy.fields.pasteApiKey}
                  />
                  <button
                    className="button-primary"
                    disabled={sessionConfigLocked}
                    onClick={() => void setApiKey(apiKeyInput)}
                  >
                    {settingsCopy.fields.saveKey}
                  </button>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.model}
              control={
                <input
                  disabled={sessionConfigLocked}
                  value={settings.api.model}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.model = event.target.value;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.apiVersionAuto}
              description={settingsCopy.fields.apiVersionHelp}
              control={<input value={settings.api.apiVersion} readOnly />}
            />
            <SettingsRow
              label={settingsCopy.fields.voice}
              control={
                <div className="voice-preview-control">
                  <select
                    disabled={sessionConfigLocked}
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
                    disabled={sessionConfigLocked}
                  />
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.allowInterruption}
              description={settingsCopy.fields.allowInterruptionHelp}
              control={
                <Switch
                  checked={settings.api.allowInterruption}
                  disabled={sessionConfigLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.api.allowInterruption = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.thinkingMode}
              description={settingsCopy.fields.thinkingModeHelp}
              control={
                <select
                  disabled={sessionConfigLocked}
                  value={settings.api.thinkingMode}
                  onChange={(event) =>
                    update((draft) => {
                      const nextMode = event.target.value as ThinkingMode;
                      draft.api.thinkingMode = nextMode;
                      if (nextMode === "off") {
                        draft.api.thinkingBudget = 0;
                      } else if (nextMode === "auto") {
                        draft.api.thinkingBudget = -1;
                      } else if (draft.api.thinkingBudget < THINKING_BUDGET_MIN) {
                        draft.api.thinkingBudget = THINKING_BUDGET_MIN;
                      }
                      return draft;
                    })
                  }
                >
                  <option value="off">{settingsCopy.options.thinkingMode.off}</option>
                  <option value="auto">{settingsCopy.options.thinkingMode.auto}</option>
                  <option value="custom">
                    {settingsCopy.options.thinkingMode.custom}
                  </option>
                </select>
              }
            />
            {settings.api.thinkingMode === "custom" ? (
              <SettingsRow
                label={settingsCopy.fields.thinkingBudget}
                description={settingsCopy.fields.thinkingBudgetHelp}
                control={
                  <input
                    disabled={sessionConfigLocked}
                    type="number"
                    min={THINKING_BUDGET_MIN}
                    max={THINKING_BUDGET_MAX}
                    value={settings.api.thinkingBudget}
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
                }
              />
            ) : null}
            <SettingsRow
              label={settingsCopy.fields.thinkingIncludeThoughts}
              control={
                <Switch
                  checked={settings.api.thinkingIncludeThoughts}
                  disabled={sessionConfigLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.api.thinkingIncludeThoughts = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.thinkingLevel}
              control={
                <select
                  disabled={sessionConfigLocked}
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
                    {settingsCopy.options.thinkingLevel.model_default}
                  </option>
                  <option value="minimal">
                    {settingsCopy.options.thinkingLevel.minimal}
                  </option>
                  <option value="low">
                    {settingsCopy.options.thinkingLevel.low}
                  </option>
                  <option value="medium">
                    {settingsCopy.options.thinkingLevel.medium}
                  </option>
                  <option value="high">
                    {settingsCopy.options.thinkingLevel.high}
                  </option>
                </select>
              }
            />
          </div>
        </SectionCard>
      ) : null}

      {activeSection === "audio" ? (
        <SectionCard
          title={settingsCopy.sections.audio}
          description="Playback level, activity detection and microphone turn segmentation."
        >
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.modelVolume}
              control={
                <div className="range-input-row">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.audio.modelVolume}
                    onChange={(event) =>
                      update((draft) => {
                        draft.audio.modelVolume = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                  <span className="value-pill">{Math.round(settings.audio.modelVolume * 100)}%</span>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.autoActivityDetection}
              control={
                <Switch
                  checked={settings.audio.detection.enabled}
                  disabled={sessionConfigLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.audio.detection.enabled = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.manualVadMode}
              control={
                <Switch
                  checked={settings.audio.detection.manualMode}
                  disabled={sessionConfigLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.audio.detection.manualMode = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.detectionSensitivity}
              control={
                <div className="range-input-row">
                  <input
                    disabled={sessionConfigLocked}
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.audio.detection.sensitivity}
                    onChange={(event) =>
                      update((draft) => {
                        draft.audio.detection.sensitivity = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                  <span className="value-pill">
                    {Math.round(settings.audio.detection.sensitivity * 100)}%
                  </span>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.silenceDurationMs}
              control={
                <input
                  disabled={sessionConfigLocked}
                  type="number"
                  value={settings.audio.detection.silenceDurationMs}
                  onChange={(event) =>
                    update((draft) => {
                      draft.audio.detection.silenceDurationMs = Number(event.target.value);
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.prefixPaddingMs}
              control={
                <input
                  disabled={sessionConfigLocked}
                  type="number"
                  value={settings.audio.detection.prefixPaddingMs}
                  onChange={(event) =>
                    update((draft) => {
                      draft.audio.detection.prefixPaddingMs = Number(event.target.value);
                      return draft;
                    })
                  }
                />
              }
            />
          </div>
        </SectionCard>
      ) : null}

      {activeSection === "visual" ? (
        <SectionCard
          title={settingsCopy.sections.visual}
          description="Screen and camera frame quality, cadence and local preview behavior."
        >
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.mediaResolution}
              control={
                <select
                  disabled={sessionConfigLocked}
                  value={settings.visual.mediaResolution}
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
                  <option value="low">{settingsCopy.options.mediaResolution.low}</option>
                  <option value="medium">{settingsCopy.options.mediaResolution.medium}</option>
                  <option value="high">{settingsCopy.options.mediaResolution.high}</option>
                </select>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.frameIntervalMs}
              control={
                <input
                  type="number"
                  value={settings.visual.frameIntervalMs}
                  onChange={(event) =>
                    update((draft) => {
                      draft.visual.frameIntervalMs = Number(event.target.value);
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.jpegQuality}
              control={
                <div className="range-input-row">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={settings.visual.jpegQuality}
                    onChange={(event) => setJpegQuality(event.target.value)}
                  />
                  <span className="value-pill">
                    {Math.round(settings.visual.jpegQuality * 100)}%
                  </span>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.changeThreshold}
              control={
                <div className="range-input-row">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.visual.changeThreshold}
                    onChange={(event) => setChangeThreshold(event.target.value)}
                  />
                  <span className="value-pill">
                    {Math.round(settings.visual.changeThreshold * 100)}%
                  </span>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.previewEnabled}
              control={
                <Switch
                  checked={settings.visual.previewEnabled}
                  onChange={(next) =>
                    update((draft) => {
                      draft.visual.previewEnabled = next;
                      return draft;
                    })
                  }
                />
              }
            />
          </div>
        </SectionCard>
      ) : null}

      {activeSection === "behavior" ? (
        <SectionCard
          title={settingsCopy.sections.behavior}
          description="Proactivity, affective dialog and system-level prompting behavior."
        >
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.proactiveMode}
              control={
                <select
                  disabled={sessionConfigLocked}
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
                  <option value="off">{settingsCopy.options.proactiveMode.off}</option>
                  <option value="pure">{settingsCopy.options.proactiveMode.pure}</option>
                  <option value="assisted">
                    {settingsCopy.options.proactiveMode.assisted}
                  </option>
                </select>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.affectiveDialog}
              control={
                <Switch
                  checked={settings.api.enableAffectiveDialog}
                  disabled={sessionConfigLocked}
                  onChange={(next) =>
                    update((draft) => {
                      draft.api.enableAffectiveDialog = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.systemPrompt}
              control={
                <textarea
                  disabled={sessionConfigLocked}
                  value={settings.behavior.systemPrompt}
                  onChange={(event) =>
                    update((draft) => {
                      draft.behavior.systemPrompt = event.target.value;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.proactivePolicy}
              control={
                <textarea
                  disabled={sessionConfigLocked}
                  value={settings.behavior.proactiveCommentaryPolicy}
                  onChange={(event) =>
                    update((draft) => {
                      draft.behavior.proactiveCommentaryPolicy = event.target.value;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.maxAutonomousFrequencyMs}
              control={
                <input
                  type="number"
                  value={settings.behavior.maxAutonomousCommentFrequencyMs}
                  onChange={(event) =>
                    update((draft) => {
                      draft.behavior.maxAutonomousCommentFrequencyMs = Number(
                        event.target.value
                      );
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.requiredSignificantFrames}
              description={settingsCopy.fields.requiredSignificantFramesHelp}
              control={
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={settings.behavior.requiredSignificantFrames}
                  onChange={(event) =>
                    update((draft) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isFinite(parsed)) {
                        return draft;
                      }
                      draft.behavior.requiredSignificantFrames = Math.max(
                        1,
                        Math.min(12, Math.round(parsed))
                      );
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.commentaryDuringSilenceOnly}
              control={
                <Switch
                  checked={settings.behavior.allowCommentaryDuringSilenceOnly}
                  onChange={(next) =>
                    update((draft) => {
                      draft.behavior.allowCommentaryDuringSilenceOnly = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.commentaryWhileIdleOnly}
              control={
                <Switch
                  checked={settings.behavior.allowCommentaryWhileUserIdleOnly}
                  onChange={(next) =>
                    update((draft) => {
                      draft.behavior.allowCommentaryWhileUserIdleOnly = next;
                      return draft;
                    })
                  }
                />
              }
            />
          </div>
        </SectionCard>
      ) : null}

      {activeSection === "diagnostics" ? (
        <SectionCard
          title={settingsCopy.sections.diagnostics}
          description="Verbose logging and export destination hints for support workflows."
        >
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.showLiveTimingPanel}
              control={
                <Switch
                  checked={settings.diagnostics.showLiveTimingPanel}
                  onChange={(next) =>
                    update((draft) => {
                      draft.diagnostics.showLiveTimingPanel = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.verboseLogging}
              control={
                <Switch
                  checked={settings.diagnostics.enableVerboseLogging}
                  onChange={(next) =>
                    update((draft) => {
                      draft.diagnostics.enableVerboseLogging = next;
                      return draft;
                    })
                  }
                />
              }
            />
            <SettingsRow
              label={settingsCopy.fields.exportPathHint}
              control={
                <input
                  value={settings.diagnostics.exportPathHint}
                  onChange={(event) =>
                    update((draft) => {
                      draft.diagnostics.exportPathHint = event.target.value;
                      return draft;
                    })
                  }
                />
              }
            />
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}
