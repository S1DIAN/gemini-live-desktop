import { app, ipcMain } from "electron";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
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
const VOICE_PREVIEW_BUNDLED_MODEL = "bundled-voice-preview";
const VOICE_PREVIEW_BUNDLED_MIME = "audio/wav";
const VOICE_PREVIEW_CACHE_CAPACITY = 64;
const VOICE_PREVIEW_MIN_INTERVAL_MS = 6200;
const VOICE_PREVIEW_MAX_RETRY_ATTEMPTS = 2;
const VOICE_PREVIEW_TRANSCRIPTS = {
  en: "Have a wonderful day!",
  ru: "\u0425\u043e\u0440\u043e\u0448\u0435\u0433\u043e \u0434\u043d\u044f!"
} as const;

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
    apiKey: string | null,
    voiceName: string,
    speechLanguageCode?: "en" | "ru"
  ) => Promise<VoicePreviewResult>;
} {
  const cache = new Map<string, VoicePreviewResult>();
  const bundledMissingKeys = new Set<string>();
  const inFlightByKey = new Map<string, Promise<VoicePreviewResult>>();
  let activeApiKey: string | null = null;
  let aiClient: GoogleGenAI | null = null;
  let queue = Promise.resolve<void>(undefined);
  let nextPreviewAllowedAt = 0;

  const runPreviewInQueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const ensureClient = (apiKey: string): GoogleGenAI => {
    if (!aiClient || activeApiKey !== apiKey) {
      activeApiKey = apiKey;
      aiClient = new GoogleGenAI({
        apiKey,
        apiVersion: "v1beta"
      });
      cache.clear();
      inFlightByKey.clear();
      queue = Promise.resolve<void>(undefined);
      nextPreviewAllowedAt = 0;
    }
    return aiClient;
  };

  const preview = async (
    apiKey: string | null,
    voiceName: string,
    speechLanguageCode: "en" | "ru" = "en"
  ): Promise<VoicePreviewResult> => {
    const cacheKey = toVoicePreviewCacheKey(voiceName, speechLanguageCode);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const bundled = await loadBundledVoicePreview(
      cacheKey,
      voiceName,
      speechLanguageCode,
      bundledMissingKeys
    );
    if (bundled) {
      cache.set(cacheKey, bundled);
      return bundled;
    }

    const inFlight = inFlightByKey.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    if (!apiKey) {
      throw new Error("No API key saved and no bundled preview found");
    }

    const ai = ensureClient(apiKey);
    const promise = runPreviewInQueue(async () => {
      await waitForVoicePreviewSlot(() => nextPreviewAllowedAt);
      const result = await previewVoice(ai, voiceName, speechLanguageCode);
      nextPreviewAllowedAt = Date.now() + VOICE_PREVIEW_MIN_INTERVAL_MS;
      return result;
    })
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
        inFlightByKey.delete(cacheKey);
      });

    inFlightByKey.set(cacheKey, promise);
    return promise;
  };

  return { preview };
}

async function loadBundledVoicePreview(
  cacheKey: string,
  voiceName: string,
  speechLanguageCode: "en" | "ru",
  bundledMissingKeys: Set<string>
): Promise<VoicePreviewResult | null> {
  if (bundledMissingKeys.has(cacheKey)) {
    return null;
  }
  const audio = await readBundledVoicePreviewAsset(voiceName, speechLanguageCode);
  if (!audio) {
    bundledMissingKeys.add(cacheKey);
    return null;
  }
  return {
    voiceName,
    model: VOICE_PREVIEW_BUNDLED_MODEL,
    mimeType: VOICE_PREVIEW_BUNDLED_MIME,
    audioBase64: audio.toString("base64")
  };
}

async function readBundledVoicePreviewAsset(
  voiceName: string,
  speechLanguageCode: "en" | "ru"
): Promise<Buffer | null> {
  const fileName = `${sanitizeVoiceName(voiceName)}.wav`;
  const requestedPath = path.join(speechLanguageCode, fileName);
  const fallbackPath = path.join("en", fileName);
  for (const rootPath of resolveVoicePreviewAssetRoots()) {
    const requested = await tryReadFile(path.join(rootPath, requestedPath));
    if (requested) {
      return requested;
    }
    if (speechLanguageCode !== "en") {
      const fallback = await tryReadFile(path.join(rootPath, fallbackPath));
      if (fallback) {
        return fallback;
      }
    }
  }
  return null;
}

function resolveVoicePreviewAssetRoots(): string[] {
  const roots = new Set<string>();
  roots.add(path.join(process.cwd(), "assets", "voice-previews"));
  roots.add(path.join(app.getAppPath(), "assets", "voice-previews"));
  roots.add(path.join(process.resourcesPath, "assets", "voice-previews"));
  return Array.from(roots);
}

function sanitizeVoiceName(voiceName: string): string {
  return voiceName.replace(/[^a-z0-9_-]/gi, "_");
}

async function tryReadFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function waitForVoicePreviewSlot(
  getNextAllowedAt: () => number
): Promise<void> {
  const waitMs = Math.max(0, getNextAllowedAt() - Date.now());
  if (waitMs <= 0) {
    return;
  }
  await delay(waitMs);
}

async function previewVoice(
  ai: GoogleGenAI,
  voiceName: string,
  speechLanguageCode: "en" | "ru" = "en"
): Promise<VoicePreviewResult> {
  let audioPart = (
    await synthesizePreview(
      ai,
      voiceName,
      VOICE_PREVIEW_TRANSCRIPTS[speechLanguageCode]
    )
  ).audioPart;

  if (!audioPart && speechLanguageCode !== "en") {
    audioPart = (await synthesizePreview(ai, voiceName, VOICE_PREVIEW_TRANSCRIPTS.en))
      .audioPart;
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
  text: string
): Promise<{
  audioPart: { inlineData?: { data?: string; mimeType?: string } } | null;
}> {
  const response = await generateVoicePreviewWithRetry(ai, voiceName, text);

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return { audioPart: part };
      }
    }
  }
  return { audioPart: null };
}

async function generateVoicePreviewWithRetry(
  ai: GoogleGenAI,
  voiceName: string,
  text: string
) {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent({
        model: VOICE_PREVIEW_MODEL,
        contents: [{ parts: [{ text }] }],
        config: {
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
    } catch (error) {
      attempt += 1;
      const retryDelayMs = getQuotaRetryDelayMs(error);
      if (
        retryDelayMs === null ||
        attempt >= VOICE_PREVIEW_MAX_RETRY_ATTEMPTS
      ) {
        throw error;
      }
      await delay(retryDelayMs);
    }
  }
}

function getQuotaRetryDelayMs(error: unknown): number | null {
  const payloadsToInspect: unknown[] = [];

  if (error && typeof error === "object") {
    payloadsToInspect.push(error);
    const maybeError = error as { error?: unknown; message?: unknown };
    if (maybeError.error) {
      payloadsToInspect.push(maybeError.error);
    }
    if (typeof maybeError.message === "string") {
      const parsed = tryParseJson(maybeError.message);
      if (parsed) {
        payloadsToInspect.push(parsed);
      }
    }
  } else if (typeof error === "string") {
    const parsed = tryParseJson(error);
    if (parsed) {
      payloadsToInspect.push(parsed);
    }
  }

  for (const payload of payloadsToInspect) {
    const delayFromDetails = extractRetryDelayFromDetails(payload);
    if (delayFromDetails !== null) {
      return delayFromDetails;
    }
    const delayFromMessage = extractRetryDelayFromMessage(payload);
    if (delayFromMessage !== null) {
      return delayFromMessage;
    }
  }

  return null;
}

function extractRetryDelayFromDetails(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const details = (payload as { details?: unknown }).details;
  if (!Array.isArray(details)) {
    return null;
  }
  for (const item of details) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const retryDelay = (item as { retryDelay?: unknown }).retryDelay;
    const parsed = parseDurationToMs(retryDelay);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function extractRetryDelayFromMessage(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message !== "string") {
    return null;
  }
  const match = message.match(/retry in\s+([\d.]+)s/i);
  if (!match) {
    return null;
  }
  const capture = match[1];
  if (!capture) {
    return null;
  }
  const seconds = Number.parseFloat(capture);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.ceil(seconds * 1000);
}

function parseDurationToMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/^([\d.]+)s$/i);
  if (!match) {
    return null;
  }
  const capture = match[1];
  if (!capture) {
    return null;
  }
  const seconds = Number.parseFloat(capture);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.ceil(seconds * 1000);
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    const firstBraceIndex = value.indexOf("{");
    const lastBraceIndex = value.lastIndexOf("}");
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      const jsonSlice = value.slice(firstBraceIndex, lastBraceIndex + 1);
      try {
        return JSON.parse(jsonSlice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
