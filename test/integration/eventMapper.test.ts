import { describe, expect, it } from "vitest";
import { mapLiveServerMessage } from "../../src/worker/live/eventMapper";
import type { LiveServerMessage } from "@google/genai";

describe("mapLiveServerMessage", () => {
  it("prefers transcription text over duplicate model turn text", () => {
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
    expect(events.filter((event) => event.type === "transcript")).toHaveLength(1);
    expect(events.some((event) => event.type === "diagnostics")).toBe(true);
  });
});
