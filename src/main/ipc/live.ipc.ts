import { ipcMain } from "electron";
import net from "node:net";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  connectPayloadSchema,
  disconnectPayloadSchema,
  previewVoicePayloadSchema,
  sendTextPayloadSchema,
  voiceTurnEventSchema
} from "../../shared/schema/ipcSchema";
import type { SettingsRepository } from "../settingsRepository";
import type { SecureKeyStorage } from "../security/secureStorage";
import type { LiveWorkerLauncher } from "../workers/liveWorkerLauncher";
import {
  getAutoApiVersion,
  resolveThinkingBudget,
  type AppSettings
} from "../../shared/types/settings";
import type { WorkerConnectRequest } from "../../shared/types/live";
import type { VoicePreviewResult } from "../../shared/types/ipc";

const VOICE_PREVIEW_MODEL = "gemini-2.5-flash-preview-tts";
const VOICE_PREVIEW_CACHE_CAPACITY = 64;
const VOICE_PREVIEW_TRANSCRIPTS = {
  en: "Have a wonderful day!",
  ru: "\u0425\u043e\u0440\u043e\u0448\u0435\u0433\u043e \u0434\u043d\u044f!"
} as const;

interface VoicePreviewInFlightRequest {
  cacheKey: string;
  controller: AbortController;
  promise: Promise<VoicePreviewResult>;
}

export function registerLiveIpc(
  repository: SettingsRepository,
  secureStorage: SecureKeyStorage,
  workerLauncher: LiveWorkerLauncher
): void {
  const voicePreviewManager = createVoicePreviewManager();

  ipcMain.handle("live:connect", async (_event, payload) => {
    const connectPayload = connectPayloadSchema.parse(payload ?? {});
    const apiKey = await secureStorage.getPlaintext();
    if (!apiKey) {
      return { ok: false, reason: "No API key saved" };
    }

    const settings = await repository.load();
    const request = mapSettingsToWorkerRequest(
      settings,
      apiKey,
      connectPayload.useMock,
      connectPayload.speechLanguageCode
    );
    return workerLauncher.connect(request);
  });

  ipcMain.handle("live:disconnect", (_event, payload) => {
    const disconnectPayload = disconnectPayloadSchema.parse(payload ?? {});
    return workerLauncher.disconnect(disconnectPayload.mode ?? "pause");
  });
  ipcMain.handle("live:preview-voice", async (_event, payload) => {
    const request = previewVoicePayloadSchema.parse(payload);
    const apiKey = await secureStorage.getPlaintext();
    if (!apiKey) {
      throw new Error("No API key saved");
    }

    return voicePreviewManager.preview(
      apiKey,
      request.voiceName,
      request.speechLanguageCode
    );
  });
  ipcMain.handle("live:send-text", (_event, payload) =>
    workerLauncher.sendText(sendTextPayloadSchema.parse(payload))
  );
  ipcMain.handle("live:voice-turn-event", (_event, payload) =>
    workerLauncher.sendVoiceTurnEvent(voiceTurnEventSchema.parse(payload))
  );
  ipcMain.handle("live:request-media-transport", (event) =>
    workerLauncher.attachMediaPorts(event.sender)
  );
  ipcMain.handle("live:probe-network-latency", () =>
    probeNetworkLatency("generativelanguage.googleapis.com", 443, 3000)
  );
}

function createVoicePreviewManager(): {
  preview: (
    apiKey: string,
    voiceName: string,
    speechLanguageCode?: "en" | "ru"
  ) => Promise<VoicePreviewResult>;
} {
  const cache = new Map<string, VoicePreviewResult>();
  let activeApiKey: string | null = null;
  let aiClient: GoogleGenAI | null = null;
  let inFlight: VoicePreviewInFlightRequest | null = null;

  const ensureClient = (apiKey: string): GoogleGenAI => {
    if (!aiClient || activeApiKey !== apiKey) {
      activeApiKey = apiKey;
      aiClient = new GoogleGenAI({
        apiKey,
        apiVersion: "v1beta"
      });
      cache.clear();
      if (inFlight) {
        inFlight.controller.abort();
        inFlight = null;
      }
    }
    return aiClient;
  };

  const preview = async (
    apiKey: string,
    voiceName: string,
    speechLanguageCode: "en" | "ru" = "en"
  ): Promise<VoicePreviewResult> => {
    const cacheKey = toVoicePreviewCacheKey(voiceName, speechLanguageCode);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (inFlight?.cacheKey === cacheKey) {
      return inFlight.promise;
    }

    if (inFlight) {
      inFlight.controller.abort();
    }

    const controller = new AbortController();
    const ai = ensureClient(apiKey);
    const promise = previewVoice(ai, voiceName, speechLanguageCode, controller.signal)
      .then((result) => {
        cache.set(cacheKey, result);
        while (cache.size > VOICE_PREVIEW_CACHE_CAPACITY) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey === undefined) {
            break;
          }
          cache.delete(oldestKey);
        }
        return result;
      })
      .finally(() => {
        if (inFlight?.promise === promise) {
          inFlight = null;
        }
      });

    inFlight = {
      cacheKey,
      controller,
      promise
    };
    return promise;
  };

  return { preview };
}

async function previewVoice(
  ai: GoogleGenAI,
  voiceName: string,
  speechLanguageCode: "en" | "ru" = "en",
  abortSignal?: AbortSignal
): Promise<VoicePreviewResult> {
  let audioPart = (
    await synthesizePreview(
      ai,
      voiceName,
      VOICE_PREVIEW_TRANSCRIPTS[speechLanguageCode],
      abortSignal
    )
  ).audioPart;

  if (!audioPart && speechLanguageCode !== "en") {
    audioPart = (
      await synthesizePreview(ai, voiceName, VOICE_PREVIEW_TRANSCRIPTS.en, abortSignal)
    ).audioPart;
  }

  if (!audioPart?.inlineData?.data) {
    throw new Error("Gemini API returned no audio for preview");
  }
  const audioBase64 = audioPart.inlineData.data;

  return {
    voiceName,
    model: VOICE_PREVIEW_MODEL,
    mimeType: audioPart.inlineData?.mimeType ?? "audio/pcm;rate=24000",
    audioBase64
  };
}

async function synthesizePreview(
  ai: GoogleGenAI,
  voiceName: string,
  text: string,
  abortSignal?: AbortSignal
): Promise<{
  audioPart: { inlineData?: { data?: string; mimeType?: string } } | null;
}> {
  const response = await ai.models.generateContent({
    model: VOICE_PREVIEW_MODEL,
    contents: [{ parts: [{ text }] }],
    config: {
      abortSignal,
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    }
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return { audioPart: part };
      }
    }
  }
  return { audioPart: null };
}

function toVoicePreviewCacheKey(
  voiceName: string,
  speechLanguageCode: "en" | "ru"
): string {
  return `${speechLanguageCode}:${voiceName}`;
}

function probeNetworkLatency(
  host: string,
  port: number,
  timeoutMs: number
): Promise<number | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.once("connect", () => {
      finish(Math.max(0, Date.now() - startedAt));
    });
    socket.once("error", () => finish(null));
    socket.setTimeout(timeoutMs, () => finish(null));
  });
}

function mapSettingsToWorkerRequest(
  settings: AppSettings,
  apiKey: string,
  useMock = false,
  speechLanguageCodeOverride?: "en" | "ru"
): WorkerConnectRequest {
  return {
    apiKey,
    useMock,
    settings: {
      model: settings.api.model,
      apiVersion: getAutoApiVersion(
        settings.api.model,
        settings.api.proactiveMode,
        settings.api.enableAffectiveDialog
      ),
      voiceName: settings.api.voiceName,
      allowInterruption: settings.api.allowInterruption,
      speechLanguageCode:
        speechLanguageCodeOverride ?? settings.api.speechLanguageCode,
      proactiveMode: settings.api.proactiveMode,
      thinkingMode: settings.api.thinkingMode,
      thinkingBudget: resolveThinkingBudget(
        settings.api.thinkingMode,
        settings.api.thinkingBudget
      ),
      thinkingIncludeThoughts: settings.api.thinkingIncludeThoughts,
      thinkingLevel: settings.api.thinkingLevel,
      mediaResolution: settings.visual.mediaResolution,
      enableAffectiveDialog: settings.api.enableAffectiveDialog,
      inputTranscriptionEnabled: settings.api.inputTranscriptionEnabled,
      outputTranscriptionEnabled: settings.api.outputTranscriptionEnabled,
      systemPrompt: settings.behavior.systemPrompt,
      proactiveCommentaryPolicy: settings.behavior.proactiveCommentaryPolicy,
      commentLengthPreset: settings.behavior.commentLengthPreset,
      maxAutonomousCommentFrequencyMs:
        settings.behavior.maxAutonomousCommentFrequencyMs,
      vadEnabled: settings.audio.detection.enabled,
      vadSensitivity: settings.audio.detection.sensitivity,
      silenceDurationMs: settings.audio.detection.silenceDurationMs,
      prefixPaddingMs: settings.audio.detection.prefixPaddingMs,
      manualVadMode: settings.audio.detection.manualMode,
      allowCommentaryDuringSilenceOnly:
        settings.behavior.allowCommentaryDuringSilenceOnly,
      allowCommentaryWhileUserIdleOnly:
        settings.behavior.allowCommentaryWhileUserIdleOnly,
      enableVerboseLogging: settings.diagnostics.enableVerboseLogging
    }
  };
}
