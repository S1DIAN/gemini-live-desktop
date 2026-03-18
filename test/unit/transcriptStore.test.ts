import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "../../src/renderer/state/transcriptStore";

describe("transcriptStore", () => {
  beforeEach(() => {
    useTranscriptStore.getState().clear();
  });

  it("replaces the latest partial entry for the same speaker even after interleaving messages", () => {
    useTranscriptStore.getState().upsert({
      id: "partial-1",
      speaker: "model",
      text: "Hello",
      status: "partial",
      createdAt: 1
    });
    useTranscriptStore.getState().upsert({
      id: "user-1",
      speaker: "user",
      text: "Hi",
      status: "final",
      createdAt: 2
    });
    useTranscriptStore.getState().upsert({
      id: "final-1",
      speaker: "model",
      text: "Hello there",
      status: "final",
      createdAt: 3
    });

    const entries = useTranscriptStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.speaker).toBe("model");
    expect(entries[0]?.id).toBe("final-1");
    expect(entries[0]?.status).toBe("final");
    expect(entries[0]?.text).toBe("Hello there");
  });

  it("starts a new message when a new partial does not continue the previous partial", () => {
    useTranscriptStore.getState().upsert({
      id: "model-partial-1",
      speaker: "model",
      text: "First answer part",
      status: "partial",
      createdAt: 1
    });
    useTranscriptStore.getState().upsert({
      id: "model-partial-2",
      speaker: "model",
      text: "Second answer starts",
      status: "partial",
      createdAt: 2
    });

    const entries = useTranscriptStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.status).toBe("final");
    expect(entries[0]?.text).toBe("First answer part");
    expect(entries[1]?.status).toBe("partial");
    expect(entries[1]?.text).toBe("Second answer starts");
  });
});
