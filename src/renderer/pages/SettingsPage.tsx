import { useMemo, useState } from "react";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { useSessionStore } from "@renderer/state/sessionStore";
import { hasLiveSession } from "@renderer/state/sessionStatus";
import { useI18n } from "@renderer/i18n/useI18n";
import { LIVE_PREBUILT_VOICE_NAMES } from "@shared/constants/liveSpeech";

export function SettingsPage() {
  const { settings, update, save, apiKeyState, setApiKey, clearApiKey } =
    useSettingsStore();
  const { copy } = useI18n();
  const sessionStatus = useSessionStore((state) => state.status);
  const retainedSessionLock = useSessionStore(
    (state) => state.connectConfigLocked
  );
  const sessionConfigLocked =
    hasLiveSession(sessionStatus) || retainedSessionLock;
  const [apiKeyInput, setApiKeyInput] = useState("");
  const settingsCopy = copy.settings;
  const voiceOptions = useMemo(() => {
    const base = Array.from(LIVE_PREBUILT_VOICE_NAMES) as string[];
    if (base.includes(settings.api.voiceName)) {
      return base;
    }
    return [settings.api.voiceName, ...base];
  }, [settings.api.voiceName]);
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
      <h1>{settingsCopy.title}</h1>
      {sessionConfigLocked ? (
        <div className="feedback-banner feedback-info settings-lock-banner">
          {settingsCopy.lockBanner}
        </div>
      ) : null}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-title">{settingsCopy.sections.api}</div>
          <label>
            {settingsCopy.fields.savedKey}
            <div className="inline-row">
              <input
                value={apiKeyState.maskedLabel}
                readOnly
                placeholder={settingsCopy.fields.noKeySaved}
              />
              <button
                disabled={sessionConfigLocked}
                onClick={() => void clearApiKey()}
              >
                {settingsCopy.fields.deleteKey}
              </button>
            </div>
          </label>
          <label>
            {settingsCopy.fields.newKey}
            <div className="inline-row">
              <input
                disabled={sessionConfigLocked}
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={settingsCopy.fields.pasteApiKey}
              />
              <button
                disabled={sessionConfigLocked}
                onClick={() => void setApiKey(apiKeyInput)}
              >
                {settingsCopy.fields.saveKey}
              </button>
            </div>
          </label>
          <label>
            {settingsCopy.fields.model}
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
          </label>
          <label>
            {settingsCopy.fields.apiVersionAuto}
            <input value={settings.api.apiVersion} readOnly />
          </label>
          <p className="field-help">{settingsCopy.fields.apiVersionHelp}</p>
          <label>
            {settingsCopy.fields.voice}
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
          </label>
          <label>
            {settingsCopy.fields.thinkingBudget}
            <input
              disabled={sessionConfigLocked}
              type="number"
              min="-1"
              max="8192"
              value={settings.api.thinkingBudget}
              onChange={(event) =>
                update((draft) => {
                  draft.api.thinkingBudget = Number(event.target.value);
                  return draft;
                })
              }
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">{settingsCopy.sections.audio}</div>
          <label>
            {settingsCopy.fields.modelVolume}
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
          </label>
          <label>
            {settingsCopy.fields.autoActivityDetection}
            <input
              disabled={sessionConfigLocked}
              type="checkbox"
              checked={settings.audio.detection.enabled}
              onChange={(event) =>
                update((draft) => {
                  draft.audio.detection.enabled = event.target.checked;
                  return draft;
                })
              }
            />
          </label>
          <label>
            {settingsCopy.fields.manualVadMode}
            <input
              disabled={sessionConfigLocked}
              type="checkbox"
              checked={settings.audio.detection.manualMode}
              onChange={(event) =>
                update((draft) => {
                  draft.audio.detection.manualMode = event.target.checked;
                  return draft;
                })
              }
            />
          </label>
          <label>
            {settingsCopy.fields.detectionSensitivity}
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
          </label>
          <label>
            {settingsCopy.fields.silenceDurationMs}
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
          </label>
          <label>
            {settingsCopy.fields.prefixPaddingMs}
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
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">{settingsCopy.sections.visual}</div>
          <label>
            {settingsCopy.fields.mediaResolution}
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
          </label>
          <label>
            {settingsCopy.fields.frameIntervalMs}
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
          </label>
          <label>
            {settingsCopy.fields.jpegQuality}
            <div className="range-input-row">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.01"
                value={settings.visual.jpegQuality}
                onChange={(event) => setJpegQuality(event.target.value)}
              />
              <input
                className="range-input-number"
                type="number"
                min="0.1"
                max="1"
                step="0.01"
                value={settings.visual.jpegQuality}
                onChange={(event) => setJpegQuality(event.target.value)}
              />
            </div>
          </label>
          <label>
            {settingsCopy.fields.changeThreshold}
            <div className="range-input-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.visual.changeThreshold}
                onChange={(event) => setChangeThreshold(event.target.value)}
              />
              <input
                className="range-input-number"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={settings.visual.changeThreshold}
                onChange={(event) => setChangeThreshold(event.target.value)}
              />
            </div>
          </label>
          <label>
            {settingsCopy.fields.previewEnabled}
            <input
              type="checkbox"
              checked={settings.visual.previewEnabled}
              onChange={(event) =>
                update((draft) => {
                  draft.visual.previewEnabled = event.target.checked;
                  return draft;
                })
              }
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">{settingsCopy.sections.behavior}</div>
          <label>
            {settingsCopy.fields.proactiveMode}
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
          </label>
          <label>
            {settingsCopy.fields.affectiveDialog}
            <input
              disabled={sessionConfigLocked}
              type="checkbox"
              checked={settings.api.enableAffectiveDialog}
              onChange={(event) =>
                update((draft) => {
                  draft.api.enableAffectiveDialog = event.target.checked;
                  return draft;
                })
              }
            />
          </label>
          <label>
            {settingsCopy.fields.systemPrompt}
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
          </label>
          <label>
            {settingsCopy.fields.proactivePolicy}
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
          </label>
          <label>
            {settingsCopy.fields.maxAutonomousFrequencyMs}
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
          </label>
          <label>
            {settingsCopy.fields.commentaryDuringSilenceOnly}
            <input
              type="checkbox"
              checked={settings.behavior.allowCommentaryDuringSilenceOnly}
              onChange={(event) =>
                update((draft) => {
                  draft.behavior.allowCommentaryDuringSilenceOnly =
                    event.target.checked;
                  return draft;
                })
              }
            />
          </label>
          <label>
            {settingsCopy.fields.commentaryWhileIdleOnly}
            <input
              type="checkbox"
              checked={settings.behavior.allowCommentaryWhileUserIdleOnly}
              onChange={(event) =>
                update((draft) => {
                  draft.behavior.allowCommentaryWhileUserIdleOnly =
                    event.target.checked;
                  return draft;
                })
              }
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">{settingsCopy.sections.diagnostics}</div>
          <label>
            {settingsCopy.fields.verboseLogging}
            <input
              type="checkbox"
              checked={settings.diagnostics.enableVerboseLogging}
              onChange={(event) =>
                update((draft) => {
                  draft.diagnostics.enableVerboseLogging = event.target.checked;
                  return draft;
                })
              }
            />
          </label>
          <label>
            {settingsCopy.fields.exportPathHint}
            <input
              value={settings.diagnostics.exportPathHint}
              onChange={(event) =>
                update((draft) => {
                  draft.diagnostics.exportPathHint = event.target.value;
                  return draft;
                })
              }
            />
          </label>
        </section>
      </div>

      <div className="page-actions">
        <button onClick={() => void save()}>{settingsCopy.saveSettings}</button>
      </div>
    </section>
  );
}
