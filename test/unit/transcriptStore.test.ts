import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "../../src/renderer/state/transcriptStore";

describe("transcriptStore", () => {
  beforeEach(() => {
    useTranscriptStore.getState().clear();
  });

  it("replaces the last partial entry with the final transcript for the same speaker", () => {
    useTranscriptStore.getState().upsert({
      id: "partial-1",
      speaker: "model",
      text: "Hello",
      status: "partial",
      createdAt: 1
    });
    useTranscriptStore.getState().upsert({
      id: "final-1",
      speaker: "model",
      text: "Hello there",
      status: "final",
      createdAt: 2
    });

    const entries = useTranscriptStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("final-1");
    expect(entries[0]?.status).toBe("final");
    expect(entries[0]?.text).toBe("Hello there");
  });
});
