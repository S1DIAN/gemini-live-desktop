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
      const replacementIndex = findLastIndex(
        next,
        (item) => item.speaker === entry.speaker && item.status === "partial"
      );
      if (replacementIndex >= 0) {
        const previous = next[replacementIndex];
        const previousText = previous?.text ?? "";
        const mergedText = mergeTranscriptText(previousText, entry.text);
        const sameUtterance = isSameUtterance(previousText, entry.text);
        if (sameUtterance) {
          next[replacementIndex] = {
            ...entry,
            text: mergedText
          };
        } else {
          next[replacementIndex] = entry;
        }
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

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) {
      return index;
    }
  }
  return -1;
}

function mergeTranscriptText(previous: string, next: string): string {
  if (!previous) {
    return next;
  }
  if (!next) {
    return previous;
  }

  if (next.startsWith(previous)) {
    return next;
  }
  if (previous.startsWith(next)) {
    return previous;
  }

  const overlap = findOverlapLength(previous, next);
  if (overlap > 0) {
    return previous + next.slice(overlap);
  }

  const previousNormalized = normalizeForComparison(previous);
  const nextNormalized = normalizeForComparison(next);
  if (previousNormalized === nextNormalized) {
    return previous;
  }
  if (nextNormalized.startsWith(previousNormalized)) {
    return next;
  }
  if (previousNormalized.startsWith(nextNormalized)) {
    return previous;
  }

  return next;
}

function findOverlapLength(previous: string, next: string): number {
  const max = Math.min(previous.length, next.length);
  for (let index = max; index > 0; index -= 1) {
    if (previous.slice(-index) === next.slice(0, index)) {
      return index;
    }
  }
  return 0;
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isSameUtterance(previous: string, next: string): boolean {
  if (!previous || !next) {
    return true;
  }

  const previousNormalized = normalizeForComparison(previous);
  const nextNormalized = normalizeForComparison(next);
  if (!previousNormalized || !nextNormalized) {
    return true;
  }

  if (
    previousNormalized === nextNormalized ||
    nextNormalized.startsWith(previousNormalized) ||
    previousNormalized.startsWith(nextNormalized)
  ) {
    return true;
  }

  const overlap = findOverlapLength(previousNormalized, nextNormalized);
  const minExpectedOverlap = Math.min(
    24,
    Math.max(6, Math.floor(Math.min(previousNormalized.length, nextNormalized.length) * 0.35))
  );
  return overlap >= minExpectedOverlap;
}
