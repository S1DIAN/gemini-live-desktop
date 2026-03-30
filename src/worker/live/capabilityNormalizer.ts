import type {
  CapabilityNormalizationDecision,
  EffectiveRuntimeConfig,
  EffectiveSessionSnapshot,
  WorkerConnectRequest
} from "../../shared/types/live";
import {
  resolveLiveModelProfile
} from "../../shared/types/liveModelProfile";
import { THINKING_BUDGET_OFF } from "../../shared/types/settings";

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

  const profile = resolveLiveModelProfile(requested.model);
  let apiVersion =
    profile.apiVersionPolicy === "fixed"
      ? profile.recommendedApiVersion
      : requested.apiVersion;
  let proactiveMode = requested.proactiveMode;
  let affectiveDialogEnabled = requested.enableAffectiveDialog;
  let proactiveAudioEnabled = proactiveMode !== "off";
  let explicitSpeechLanguageCode: WorkerConnectRequest["settings"]["speechLanguageCode"] | undefined;

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

  if (!profile.supportsProactiveAudio) {
    if (proactiveMode !== "off") {
      decisions.push({
        field: "proactivity.proactiveAudio",
        action: "disabled",
        reason: `proactive audio is not supported by model ${requested.model}`
      });
    } else {
      decisions.push({
        field: "proactivity.proactiveAudio",
        action: "disabled",
        reason: `proactive audio is not supported by model ${requested.model}`
      });
    }
    proactiveMode = "off";
    proactiveAudioEnabled = false;
  } else if (
    profile.apiVersionPolicy === "feature_gated" &&
    proactiveAudioEnabled &&
    apiVersion === "v1beta"
  ) {
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

  if (!profile.supportsAffectiveDialog) {
    if (affectiveDialogEnabled) {
      decisions.push({
        field: "enableAffectiveDialog",
        action: "disabled",
        reason: `affective dialog is not supported by model ${requested.model}`
      });
    } else {
      decisions.push({
        field: "enableAffectiveDialog",
        action: "disabled",
        reason: `affective dialog is not supported by model ${requested.model}`
      });
    }
    affectiveDialogEnabled = false;
  } else if (
    profile.apiVersionPolicy === "feature_gated" &&
    affectiveDialogEnabled &&
    apiVersion === "v1beta"
  ) {
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

  if (profile.apiVersionPolicy === "fixed") {
    decisions.push({
      field: "apiVersion",
      action: apiVersion === requested.apiVersion ? "kept" : "disabled",
      reason: `model ${requested.model} uses fixed API version ${apiVersion}`
    });
  }

  if (profile.speechLanguagePolicy === "omit_explicit") {
    explicitSpeechLanguageCode = undefined;
  } else {
    explicitSpeechLanguageCode = shouldDisableExplicitSpeechLanguageCode(
      requested.model,
      requested.speechLanguageCode
    )
      ? undefined
      : requested.speechLanguageCode;
  }

  const snapshot: EffectiveSessionSnapshot = {
    model: requested.model,
    modelPreset: profile.preset,
    apiVersion,
    voiceName: requested.voiceName,
    allowInterruption: requested.allowInterruption,
    speechLanguageCode: explicitSpeechLanguageCode,
    speechLanguagePolicy: profile.speechLanguagePolicy,
    proactiveMode,
    thinkingMode: requested.thinkingMode,
    thinkingBudget:
      profile.thinkingPolicy === "level_primary" &&
      requested.thinkingMode !== "off"
        ? THINKING_BUDGET_OFF
        : requested.thinkingBudget,
    thinkingIncludeThoughts: requested.thinkingIncludeThoughts,
    thinkingLevel:
      requested.thinkingMode === "off" ? "model_default" : requested.thinkingLevel,
    thinkingPolicy: profile.thinkingPolicy,
    textTransportPolicy: profile.textTransportPolicy,
    mediaResolution: requested.mediaResolution,
    turnCoveragePolicy: profile.turnCoveragePolicy,
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
    profile.speechLanguagePolicy === "omit_explicit"
      ? {
          field: "speechConfig.languageCode",
          action: "disabled" as const,
          reason: `explicit speech language is disabled for model ${requested.model}`
        }
      : explicitSpeechLanguageCode
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
    profile.thinkingPolicy === "level_primary"
      ? requested.thinkingMode === "off"
        ? {
            field: "thinkingConfig.thinkingBudget",
            action: "kept" as const,
            reason: "thinking mode is off, so thinking budget is forced to 0"
          }
        : {
            field: "thinkingConfig.thinkingBudget",
            action: "disabled" as const,
            reason: "selected model uses thinkingLevel as primary thinking control"
          }
      : {
          field: "thinkingConfig.thinkingBudget",
          action: "kept" as const,
          reason: `thinking mode=${requested.thinkingMode}, budget=${requested.thinkingBudget}`
        },
    {
      field: "thinkingConfig.includeThoughts",
      action: requested.thinkingIncludeThoughts ? "kept" : "disabled",
      reason: requested.thinkingIncludeThoughts
        ? "thought summaries enabled"
        : "thought summaries disabled"
    },
    {
      field: "thinkingConfig.thinkingLevel",
      action:
        requested.thinkingMode === "off" ||
        requested.thinkingLevel === "model_default"
          ? "disabled"
          : "kept",
      reason:
        requested.thinkingMode === "off"
          ? "thinking mode is off"
          : requested.thinkingLevel === "model_default"
          ? "model default thinking level is used"
          : `thinking level set to ${requested.thinkingLevel}`
    },
    {
      field: "textTransport",
      action: "kept",
      reason:
        profile.textTransportPolicy === "realtime_only"
          ? "text turns are sent through sendRealtimeInput"
          : "manual and startup text use sendClientContent, proactive hints use sendRealtimeInput"
    },
    {
      field: "mediaResolution",
      action: "kept",
      reason: `media resolution set to ${requested.mediaResolution}`
    },
    {
      field: "realtimeInputConfig.turnCoverage",
      action: "kept",
      reason: "turn coverage is pinned to TURN_INCLUDES_ONLY_ACTIVITY"
    },
    {
      field: "realtimeInputConfig.activityHandling",
      action: "kept",
      reason: requested.allowInterruption
        ? "model response can be interrupted by start of user activity"
        : "model response interruption is disabled"
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
