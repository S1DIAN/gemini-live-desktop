import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL,
  GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
  getLiveModelDisplayName,
  resolveLiveModelProfile,
  resolveLiveModelPreset,
  resolveModelFromPreset,
  type LiveModelPreset
} from "@shared/types/liveModelProfile";
import { PageHeader } from "@renderer/components/layout/PageHeader";
import { SectionCard } from "@renderer/components/layout/SectionCard";
import { SettingsRow } from "@renderer/components/layout/SettingsRow";
import { Switch } from "@renderer/components/ui/Switch";
import { VoicePreviewButton } from "@renderer/components/VoicePreviewButton";

type SettingsSectionKey = "api" | "audio" | "visual" | "behavior" | "diagnostics";

export function SettingsPage() {
  const { settings, update, apiKeyState, setApiKey, clearApiKey } =
    useSettingsStore();
  const { copy, locale } = useI18n();
  const sessionStatus = useSessionStore((state) => state.status);
  const retainedSessionLock = useSessionStore(
    (state) => state.connectConfigLocked
  );
  const sessionConfigLocked =
    hasLiveSession(sessionStatus) || retainedSessionLock;
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const apiKeySaveInFlightRef = useRef(false);
  const lastSavedApiKeyRef = useRef("");
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("api");
  const [voicePreviewError, setVoicePreviewError] = useState("");
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const voicePickerRef = useRef<HTMLDivElement | null>(null);
  const settingsCopy = copy.settings;
  const settingsHelp = settingsCopy.help;
  const modelProfile = useMemo(
    () => resolveLiveModelProfile(settings.api.model),
    [settings.api.model]
  );
  const modelPreset = useMemo(
    () => resolveLiveModelPreset(settings.api.model),
    [settings.api.model]
  );
  const modelPresetLabel =
    locale === "ru" ? "Пресет модели" : "Model Preset";
  const modelPresetHelpText =
    locale === "ru"
      ? "Быстрый выбор совместимого профиля. Custom оставляет поле модели редактируемым вручную."
      : "Quick selection of a compatible profile. Custom keeps model input fully manual.";
  const modelPresetOptions: { value: LiveModelPreset; label: string }[] = useMemo(
    () => [
      {
        value: "gemini_2_5",
        label: "Gemini 2.5 Flash Native Audio"
      },
      {
        value: "gemini_3_1",
        label: "Gemini 3.1 Flash Live Preview"
      },
      {
        value: "custom",
        label: locale === "ru" ? "Custom (свой)" : "Custom"
      }
    ],
    [locale]
  );
  const proactiveModelUnsupported = !modelProfile.supportsProactiveAudio;
  const affectiveModelUnsupported = !modelProfile.supportsAffectiveDialog;
  const thinkingBudgetSupported = modelProfile.thinkingPolicy === "budget_primary";
  const displayedThinkingLevel =
    settings.api.thinkingMode === "off"
      ? "model_default"
      : settings.api.thinkingLevel;
  const proactiveUnsupportedReason = proactiveModelUnsupported
    ? locale === "ru"
      ? `Для модели ${settings.api.model} проактивный режим недоступен.`
      : `Proactive mode is unavailable for model ${settings.api.model}.`
    : "";
  const affectiveUnsupportedReason = affectiveModelUnsupported
    ? locale === "ru"
      ? `Для модели ${settings.api.model} аффективный диалог недоступен.`
      : `Affective dialog is unavailable for model ${settings.api.model}.`
    : "";

  const thinkingBudgetUnsupportedReason = !thinkingBudgetSupported
    ? locale === "ru"
      ? `Для модели ${settings.api.model} бюджет размышления не настраивается вручную: используйте "Уровень размышления".`
      : `Thinking budget is not manually configurable for model ${settings.api.model}. Use Thinking Level instead.`
    : "";

  const modelSelectorOptions = [
    {
      value: GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL,
      label: getLiveModelDisplayName(GEMINI_2_5_FLASH_NATIVE_AUDIO_MODEL)
    },
    {
      value: GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL,
      label: getLiveModelDisplayName(GEMINI_3_1_FLASH_LIVE_PREVIEW_MODEL)
    }
  ] as const;
  const proactiveUnavailableText = proactiveModelUnsupported
    ? locale === "ru"
      ? "Проактивный режим недоступен для Gemini 3.1 Flash. Переключитесь на Gemini 2.5."
      : "Proactive mode is unavailable for Gemini 3.1 Flash. Switch to Gemini 2.5."
    : undefined;
  const affectiveUnavailableText = affectiveModelUnsupported
    ? locale === "ru"
      ? "Аффективный диалог недоступен для Gemini 3.1 Flash. Переключитесь на Gemini 2.5."
      : "Affective dialog is unavailable for Gemini 3.1 Flash. Switch to Gemini 2.5."
    : undefined;

  const proactiveWarningText = proactiveModelUnsupported
    ? locale === "ru"
      ? "Проактивный режим недоступен для gemini 3.1 flash live preview. Переключитесь на gemini 2.5 flash native audio."
      : "Proactive mode is unavailable for gemini 3.1 flash live preview. Switch to gemini 2.5 flash native audio."
    : proactiveUnavailableText;
  const affectiveWarningText = affectiveModelUnsupported
    ? locale === "ru"
      ? "Аффективный диалог недоступен для gemini 3.1 flash live preview. Переключитесь на gemini 2.5 flash native audio."
      : "Affective dialog is unavailable for gemini 3.1 flash live preview. Switch to gemini 2.5 flash native audio."
    : affectiveUnavailableText;

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

  const persistApiKey = async (rawValue: string) => {
    const nextKey = rawValue.trim();
    if (
      !nextKey ||
      apiKeySaveInFlightRef.current ||
      nextKey === lastSavedApiKeyRef.current
    ) {
      return;
    }
    apiKeySaveInFlightRef.current = true;
    setApiKeySaving(true);
    try {
      await setApiKey(nextKey);
      lastSavedApiKeyRef.current = nextKey;
    } finally {
      apiKeySaveInFlightRef.current = false;
      setApiKeySaving(false);
    }
  };

  useEffect(() => {
    if (!apiKeyInput.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persistApiKey(apiKeyInput);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [apiKeyInput]);

  useEffect(() => {
    if (!voicePickerOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (voicePickerRef.current?.contains(target)) {
        return;
      }
      setVoicePickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [voicePickerOpen]);

  return (
    <section className="page settings-page">
      <PageHeader
        title={settingsCopy.title}
        subtitle={settingsCopy.subtitle}
        meta={settingsCopy.meta}
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
        <SectionCard title={settingsCopy.sections.api}>
          <div className="settings-list">
            <SettingsRow
              className="settings-row-wide-control"
              label={settingsCopy.fields.savedKey}
              description={apiKeyState.maskedLabel || settingsCopy.fields.noKeySaved}
              control={
                <div className="api-key-control">
                  <input
                    disabled={sessionConfigLocked || apiKeySaving}
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    onBlur={() => void persistApiKey(apiKeyInput)}
                    onPaste={(event) => {
                      event.preventDefault();
                      const pasted = event.clipboardData.getData("text");
                      if (!pasted.trim()) {
                        return;
                      }
                      setApiKeyInput(pasted);
                      void persistApiKey(pasted);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void persistApiKey(apiKeyInput);
                      }
                    }}
                    placeholder={
                      apiKeyState.maskedLabel || settingsCopy.fields.pasteApiKey
                    }
                  />
                  <button
                    className="button-secondary"
                    disabled={sessionConfigLocked || !apiKeyState.hasKey}
                    onClick={() => {
                      lastSavedApiKeyRef.current = "";
                      setApiKeyInput("");
                      void clearApiKey();
                    }}
                  >
                    {settingsCopy.fields.deleteKey}
                  </button>
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.model}
              helpText={settingsHelp.fields.model}
              control={
                <select
                  disabled={sessionConfigLocked}
                  value={settings.api.model}
                  onChange={(event) =>
                    update((draft) => {
                      draft.api.model = event.target.value;
                      return draft;
                    })
                  }
                >
                  {modelSelectorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.apiVersionAuto}
              helpText={settingsHelp.fields.apiVersionAuto}
              control={<input value={settings.api.apiVersion} readOnly />}
            />
            <SettingsRow
              label={settingsCopy.fields.voice}
              helpText={settingsHelp.fields.voice}
              description={voicePreviewError || undefined}
              control={
                <div className="voice-picker" ref={voicePickerRef}>
                  <button
                    type="button"
                    className="voice-picker-trigger"
                    disabled={sessionConfigLocked}
                    onClick={() => setVoicePickerOpen((state) => !state)}
                  >
                    <span className="voice-picker-trigger-label">
                      {settings.api.voiceName}
                    </span>
                    <span className="voice-picker-trigger-caret" aria-hidden="true">
                      v
                    </span>
                  </button>
                  {voicePickerOpen ? (
                    <div className="voice-picker-menu">
                      {voiceOptions.map((voiceName) => (
                        <div key={voiceName} className="voice-picker-item">
                          <VoicePreviewButton
                            voiceName={voiceName}
                            disabled={sessionConfigLocked}
                            compact
                            onError={(error) =>
                              setVoicePreviewError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            }
                          />
                          <button
                            type="button"
                            className={
                              voiceName === settings.api.voiceName
                                ? "voice-picker-option active"
                                : "voice-picker-option"
                            }
                            onClick={() => {
                              setVoicePreviewError("");
                              setVoicePickerOpen(false);
                              update((draft) => {
                                draft.api.voiceName = voiceName;
                                return draft;
                              });
                            }}
                          >
                            {voiceName}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
            <SettingsRow
              label={settingsCopy.fields.allowInterruption}
              helpText={settingsHelp.fields.allowInterruption}
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
              helpText={settingsHelp.fields.thinkingMode}
              description={thinkingBudgetUnsupportedReason || undefined}
              control={
                <select
                  disabled={sessionConfigLocked}
                  value={settings.api.thinkingMode}
                  onChange={(event) =>
                    update((draft) => {
                      const nextMode = event.target.value as ThinkingMode;
                      const nextModelProfile = resolveLiveModelProfile(
                        draft.api.model
                      );
                      const normalizedMode =
                        nextModelProfile.thinkingPolicy === "level_primary" &&
                        nextMode === "custom"
                          ? "auto"
                          : nextMode;
                      draft.api.thinkingMode = normalizedMode;
                      if (normalizedMode === "off") {
                        draft.api.thinkingBudget = 0;
                      } else if (
                        normalizedMode === "auto" ||
                        nextModelProfile.thinkingPolicy === "level_primary"
                      ) {
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
                  {thinkingBudgetSupported ? (
                    <option value="custom">
                      {settingsCopy.options.thinkingMode.custom}
                    </option>
                  ) : null}
                </select>
              }
            />
            {thinkingBudgetSupported && settings.api.thinkingMode === "custom" ? (
              <SettingsRow
                label={settingsCopy.fields.thinkingBudget}
                helpText={settingsHelp.fields.thinkingBudget}
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
              helpText={settingsHelp.fields.thinkingIncludeThoughts}
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
              helpText={settingsHelp.fields.thinkingLevel}
              control={
                <select
                  disabled={sessionConfigLocked}
                  value={displayedThinkingLevel}
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
        <SectionCard title={settingsCopy.sections.audio}>
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.modelVolume}
              helpText={settingsHelp.fields.modelVolume}
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
              helpText={settingsHelp.fields.autoActivityDetection}
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
              helpText={settingsHelp.fields.manualVadMode}
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
              helpText={settingsHelp.fields.detectionSensitivity}
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
              helpText={settingsHelp.fields.silenceDurationMs}
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
              helpText={settingsHelp.fields.prefixPaddingMs}
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
        <SectionCard title={settingsCopy.sections.visual}>
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.mediaResolution}
              helpText={settingsHelp.fields.mediaResolution}
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
              helpText={settingsHelp.fields.frameIntervalMs}
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
              helpText={settingsHelp.fields.jpegQuality}
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
              helpText={settingsHelp.fields.changeThreshold}
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
              helpText={settingsHelp.fields.previewEnabled}
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
        <SectionCard title={settingsCopy.sections.behavior}>
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.proactiveMode}
              helpText={settingsHelp.fields.proactiveMode}
              warningText={proactiveWarningText}
              muted={proactiveModelUnsupported}
              control={
                <select
                  disabled={sessionConfigLocked || proactiveModelUnsupported}
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
              helpText={settingsHelp.fields.affectiveDialog}
              warningText={affectiveWarningText}
              muted={affectiveModelUnsupported}
              control={
                <Switch
                  checked={settings.api.enableAffectiveDialog}
                  disabled={sessionConfigLocked || affectiveModelUnsupported}
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
              helpText={settingsHelp.fields.systemPrompt}
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
              helpText={settingsHelp.fields.proactivePolicy}
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
              helpText={settingsHelp.fields.maxAutonomousFrequencyMs}
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
              helpText={settingsHelp.fields.requiredSignificantFrames}
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
              helpText={settingsHelp.fields.commentaryDuringSilenceOnly}
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
              helpText={settingsHelp.fields.commentaryWhileIdleOnly}
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
        <SectionCard title={settingsCopy.sections.diagnostics}>
          <div className="settings-list">
            <SettingsRow
              label={settingsCopy.fields.showLiveTimingPanel}
              helpText={settingsHelp.fields.showLiveTimingPanel}
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
              helpText={settingsHelp.fields.verboseLogging}
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
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}
