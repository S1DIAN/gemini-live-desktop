import type { LiveServerMessage, Part } from "@google/genai";
import type { DiagnosticsEvent } from "../../shared/types/diagnostics";
import type { TranscriptEntry } from "../../shared/types/transcript";
import type { WorkerEvent } from "../../shared/types/live";

export function mapLiveServerMessage(
  message: LiveServerMessage,
  turnId?: string
): WorkerEvent[] {
  const events: WorkerEvent[] = [];

  if (message.goAway) {
    events.push(
      diagnostics(
        "info",
        "session",
        "GoAway received",
        message.goAway as unknown as Record<string, unknown>
      )
    );
  }

  if (message.sessionResumptionUpdate) {
    events.push(
      diagnostics(
        "info",
        "session",
        "SessionResumptionUpdate received",
        message.sessionResumptionUpdate as Record<string, unknown>
      )
    );
  }

  const serverContent = message.serverContent;
  if (!serverContent) {
    return events;
  }

  if (serverContent.generationComplete) {
    events.push(
      diagnostics("info", "session", "generationComplete received", {
        waitingForInput: serverContent.waitingForInput ?? false
      })
    );
  }

  if (serverContent.interrupted) {
    events.push(diagnostics("warn", "session", "interrupted received"));
    events.push({ type: "playback-clear" });
  }

  if (serverContent.inputTranscription?.text) {
    events.push({
      type: "transcript",
      payload: transcript(
        "user",
        serverContent.inputTranscription.text,
        serverContent.inputTranscription.finished ?? false
      )
    });
  }

  if (serverContent.outputTranscription?.text) {
    events.push({
      type: "transcript",
      payload: transcript(
        "model",
        serverContent.outputTranscription.text,
        serverContent.outputTranscription.finished ?? false
      )
    });
  }

  const audioParts = (serverContent.modelTurn?.parts ?? []).filter(
    (part): part is Part & { inlineData: NonNullable<Part["inlineData"]> } =>
      Boolean(part.inlineData?.data)
  );

  for (const part of audioParts) {
    const bytes = Array.from(Buffer.from(part.inlineData.data ?? "", "base64"));
    events.push({
      type: "audio-output",
      payload: {
        mimeType: part.inlineData.mimeType ?? "audio/pcm;rate=24000",
        data: bytes,
        turnId
      }
    });
  }

  const modelText = serverContent.modelTurn?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (modelText) {
    events.push({
      type: "transcript",
      payload: transcript("model", modelText, serverContent.turnComplete ?? false)
    });
  }

  return events;
}

function transcript(
  speaker: TranscriptEntry["speaker"],
  text: string,
  finished: boolean
): TranscriptEntry {
  return {
    id: crypto.randomUUID(),
    speaker,
    text,
    status: finished ? "final" : "partial",
    createdAt: Date.now()
  };
}

function diagnostics(
  level: DiagnosticsEvent["level"],
  category: DiagnosticsEvent["category"],
  message: string,
  details?: Record<string, unknown>
): WorkerEvent {
  return {
    type: "diagnostics",
    payload: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      event: toEventName(message),
      level,
      category,
      message,
      details
    }
  };
}

function toEventName(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
