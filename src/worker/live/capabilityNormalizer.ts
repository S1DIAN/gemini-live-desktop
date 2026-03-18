import type {
  CapabilityNormalizationDecision,
  EffectiveRuntimeConfig,
  EffectiveSessionSnapshot,
  WorkerConnectRequest
} from "../../shared/types/live";

export interface NormalizedConnectResult {
  ok: boolean;
  reason?: string;
  effectiveConfig?: EffectiveRuntimeConfig;
}

export function normalizeConnectRequest(
  request: WorkerConnectRequest
): NormalizedConnectResult {
  const decisions: CapabilityNormalizationDecision[] = [];
  const requested = request.settings;

  if (!request.apiKey.trim()) {
    return {
      ok: false,
      reason: "API key is missing"
    };
  }

  if (!requested.model.trim()) {
    return {
      ok: false,
      reason: "Model is required"
    };
  }

  let apiVersion = requested.apiVersion;
  const proactiveAudioEnabled = requested.proactiveMode !== "off";
  const affectiveDialogEnabled = requested.enableAffectiveDialog;
  const explicitSpeechLanguageCode = shouldDisableExplicitSpeechLanguageCode(
    requested.model,
    requested.speechLanguageCode
  )
    ? undefined
    : requested.speechLanguageCode;

  if (requested.manualVadMode) {
    decisions.push({
      field: "realtimeInputConfig.automaticActivityDetection.disabled",
      action: "disabled",
      reason:
        "manual VAD signaling (activityStart/activityEnd) is not wired in this client yet, so automatic activity detection remains active"
    });
  } else {
    decisions.push({
      field: "realtimeInputConfig.automaticActivityDetection.disabled",
      action: "disabled",
      reason:
        "automatic activity detection remains active"
    });
  }

  if (proactiveAudioEnabled && apiVersion === "v1beta") {
    apiVersion = "v1alpha";
    decisions.push({
      field: "proactivity.proactiveAudio",
      action: "upgraded_api_version",
      reason: "proactiveAudio is alpha-only and requires v1alpha"
    });
  } else {
    decisions.push({
      field: "proactivity.proactiveAudio",
      action: proactiveAudioEnabled ? "kept" : "disabled",
      reason: proactiveAudioEnabled
        ? "proactivity enabled for autonomous start behavior"
        : "proactivity disabled by settings"
    });
  }

  if (affectiveDialogEnabled && apiVersion === "v1beta") {
    apiVersion = "v1alpha";
    decisions.push({
      field: "enableAffectiveDialog",
      action: "upgraded_api_version",
      reason: "enableAffectiveDialog is treated as alpha-only"
    });
  } else {
    decisions.push({
      field: "enableAffectiveDialog",
      action: affectiveDialogEnabled ? "kept" : "disabled",
      reason: affectiveDialogEnabled
        ? "affective dialog allowed in effective config"
        : "affective dialog disabled by settings"
    });
  }

  const snapshot: EffectiveSessionSnapshot = {
    model: requested.model,
    apiVersion,
    voiceName: requested.voiceName,
    speechLanguageCode: explicitSpeechLanguageCode,
    proactiveMode: requested.proactiveMode,
    thinkingBudget: requested.thinkingBudget,
    mediaResolution: requested.mediaResolution,
    proactiveAudioEnabled,
    affectiveDialogEnabled,
    contextWindowCompressionEnabled: true,
    sessionResumptionEnabled: true,
    customActivityDetectionEnabled: requested.vadEnabled,
    vadSensitivity: requested.vadSensitivity,
    silenceDurationMs: requested.silenceDurationMs,
    prefixPaddingMs: requested.prefixPaddingMs,
    inputTranscriptionEnabled: requested.inputTranscriptionEnabled,
    outputTranscriptionEnabled: requested.outputTranscriptionEnabled,
    allowCommentaryDuringSilenceOnly:
      requested.allowCommentaryDuringSilenceOnly,
    allowCommentaryWhileUserIdleOnly:
      requested.allowCommentaryWhileUserIdleOnly,
    verboseDiagnosticsEnabled: requested.enableVerboseLogging
  };

  decisions.push(
    explicitSpeechLanguageCode
      ? {
          field: "speechConfig.languageCode",
          action: "kept" as const,
          reason: `speech language set to ${explicitSpeechLanguageCode}`
        }
      : {
          field: "speechConfig.languageCode",
          action: "disabled" as const,
          reason:
            "explicit speech language disabled for this model to avoid backend unsupported-language disconnects"
        },
    {
      field: "thinkingConfig.thinkingBudget",
      action: "kept",
      reason: `thinking budget set to ${requested.thinkingBudget}`
    },
    {
      field: "mediaResolution",
      action: "kept",
      reason: `media resolution set to ${requested.mediaResolution}`
    },
    {
      field: "realtimeInput.automaticActivityDetection",
      action: requested.vadEnabled ? "kept" : "disabled",
      reason: requested.vadEnabled
        ? "custom activity detection settings are enabled"
        : "SDK default activity detection settings will be used"
    },
    {
      field: "sessionResumption",
      action: "kept",
      reason: "session resumption is always enabled for live sessions"
    },
    {
      field: "contextWindowCompression",
      action: "kept",
      reason: "context window compression is always enabled"
    }
  );

  return {
    ok: true,
    effectiveConfig: {
      snapshot,
      diagnostics: decisions
    }
  };
}

function shouldDisableExplicitSpeechLanguageCode(
  model: string,
  speechLanguageCode: WorkerConnectRequest["settings"]["speechLanguageCode"]
): boolean {
  return (
    model === "gemini-2.5-flash-native-audio-preview-12-2025" &&
    speechLanguageCode === "ru"
  );
}
