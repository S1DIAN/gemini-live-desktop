import { describe, expect, it } from "vitest";
import { mapLiveServerMessage } from "../../src/worker/live/eventMapper";
import type { LiveServerMessage } from "@google/genai";

describe("mapLiveServerMessage", () => {
  it("emits diagnostics, transcript and playback clear events", () => {
    const events = mapLiveServerMessage({
      goAway: { timeLeft: "5s" },
      sessionResumptionUpdate: { newHandle: "h1", resumable: true },
      serverContent: {
        interrupted: true,
        generationComplete: true,
        inputTranscription: { text: "user", finished: true },
        outputTranscription: { text: "model", finished: true },
        modelTurn: {
          parts: [{ text: "reply" }]
        }
      }
    } as LiveServerMessage);

    expect(events.some((event) => event.type === "playback-clear")).toBe(true);
    expect(events.some((event) => event.type === "transcript")).toBe(true);
    expect(events.some((event) => event.type === "diagnostics")).toBe(true);
  });
});
