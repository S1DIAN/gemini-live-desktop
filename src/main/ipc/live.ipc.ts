import { ipcMain } from "electron";
import net from "node:net";
import {
  connectPayloadSchema,
  disconnectPayloadSchema,
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

export function registerLiveIpc(
  repository: SettingsRepository,
  secureStorage: SecureKeyStorage,
  workerLauncher: LiveWorkerLauncher
): void {
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
        settings.api.proactiveMode,
        settings.api.enableAffectiveDialog
      ),
      voiceName: settings.api.voiceName,
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
