import type { MessageEvent } from "electron";
import type { MediaPortMessage, WorkerCommand } from "../shared/types/live";
import { toErrorDetails } from "../shared/utils/errorDetails";
import { normalizeConnectRequest } from "./live/capabilityNormalizer";
import { LiveSessionManager } from "./live/liveSessionManager";

const parentPort = process.parentPort;

if (!parentPort) {
  throw new Error("Utility process parent port is not available");
}

const sessionManager = new LiveSessionManager({
  emit: (event) => {
    parentPort.postMessage(event);
  }
});

parentPort.postMessage({ type: "worker-ready" });

parentPort.on("message", async (event: MessageEvent) => {
  const message = (event.data ?? event) as WorkerCommand;

  if (message.type === "attach-media-port") {
    const port = event.ports?.[0];
    port?.start();
    port?.on("message", (portEvent: MessageEvent) => {
      sessionManager.handleMediaMessage(portEvent.data as MediaPortMessage);
    });
    return;
  }

  if (message.type === "connect") {
    try {
      parentPort.postMessage({
        type: "diagnostics",
        payload: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "info",
          category: "session",
          message: "Worker received connect command",
          details: {
            model: message.payload.settings.model,
            requestedApiVersion: message.payload.settings.apiVersion,
            proactiveMode: message.payload.settings.proactiveMode,
            useMock: message.payload.useMock ?? false
          }
        }
      });
      const normalized = normalizeConnectRequest(message.payload);
      if (!normalized.ok || !normalized.effectiveConfig) {
        parentPort.postMessage({
          type: "connect-result",
          payload: { ok: false, reason: normalized.reason ?? "Normalization failed" }
        });
        return;
      }

      parentPort.postMessage({
        type: "effective-config",
        payload: normalized.effectiveConfig
      });

      for (const decision of normalized.effectiveConfig.diagnostics) {
        parentPort.postMessage({
          type: "diagnostics",
          payload: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level: decision.action === "failed" ? "error" : "info",
            category: "capability",
            message: `Capability normalization: ${decision.field}`,
            details: decision
          }
        });
      }

      parentPort.postMessage({
        type: "diagnostics",
        payload: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "info",
          category: "session",
          message: "Opening Gemini Live session",
          details: normalized.effectiveConfig.snapshot as unknown as Record<string, unknown>
        }
      });

      await sessionManager.connect(message.payload, normalized.effectiveConfig);
      parentPort.postMessage({
        type: "connect-result",
        payload: { ok: true }
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      parentPort.postMessage({
        type: "diagnostics",
        payload: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "error",
          category: "session",
          message: "Live session connect failed",
          details: {
            reason,
            error: toErrorDetails(error)
          }
        }
      });
      parentPort.postMessage({
        type: "connect-result",
        payload: { ok: false, reason }
      });
    }
    return;
  }

  if (message.type === "disconnect") {
    await sessionManager.disconnect(message.payload?.mode ?? "pause");
    return;
  }

  if (message.type === "send-text") {
    sessionManager.sendText(message.payload);
    return;
  }

  if (message.type === "voice-turn-event") {
    sessionManager.handleVoiceTurnEvent(message.payload);
  }
});
