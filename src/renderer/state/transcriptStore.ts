import { create } from "zustand";
import type { TranscriptEntry } from "@shared/types/transcript";

interface TranscriptStoreState {
  entries: TranscriptEntry[];
  upsert: (entry: TranscriptEntry) => void;
  clear: () => void;
}

export const useTranscriptStore = create<TranscriptStoreState>((set) => ({
  entries: [],
  upsert(entry) {
    set((state) => {
      const next = [...state.entries];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      if (
        last &&
        last.speaker === entry.speaker &&
        last.status === "partial"
      ) {
        next[lastIndex] = entry;
      } else {
        next.push(entry);
      }
      return { entries: next.slice(-300) };
    });
  },
  clear() {
    set({ entries: [] });
  }
}));
