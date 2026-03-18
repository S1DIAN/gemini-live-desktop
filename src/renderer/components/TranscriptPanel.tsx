import { useEffect, useRef, type ReactNode } from "react";
import type { TranscriptEntry } from "@shared/types/transcript";
import { useI18n } from "@renderer/i18n/useI18n";

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  composer?: ReactNode;
}

export function TranscriptPanel({ entries, composer }: TranscriptPanelProps) {
  const { copy } = useI18n();
  const finalEntries = entries.filter(
    (entry) => entry.status === "final" && entry.text.trim().length > 0
  );
  const displayEntries = mergeFinalTranscriptEntries(finalEntries);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [displayEntries]);

  return (
    <section className="section-card transcript-panel">
      <div className="section-card-header">
        <div>
          <h2 className="section-card-title">{copy.transcript.title}</h2>
        </div>
      </div>
      <div className="transcript-panel-body">
        <div ref={threadRef} className="transcript-thread" aria-live="polite">
          {displayEntries.length === 0 ? (
            <div className="transcript-empty">
              <div className="empty-state-copy">{copy.transcript.empty}</div>
            </div>
          ) : null}
          {displayEntries.map((entry) => (
            <div
              key={entry.id}
              className={`transcript-message transcript-message-${entry.speaker} is-final`}
            >
              <div className="transcript-message-meta">
                <span>{copy.transcript.speaker[entry.speaker]}</span>
              </div>
              <p className="transcript-message-bubble">{entry.text}</p>
            </div>
          ))}
        </div>
        {composer ? <div className="transcript-composer">{composer}</div> : null}
      </div>
    </section>
  );
}

function mergeFinalTranscriptEntries(entries: TranscriptEntry[]): TranscriptEntry[] {
  const merged: TranscriptEntry[] = [];

  for (const entry of entries) {
    const last = merged[merged.length - 1];
    if (!last || !shouldMerge(last, entry)) {
      merged.push({ ...entry });
      continue;
    }

    last.text = joinTranscriptChunk(last.text, entry.text);
    last.createdAt = entry.createdAt;
    last.id = `${last.id}:${entry.id}`;
  }

  return merged;
}

function shouldMerge(previous: TranscriptEntry, next: TranscriptEntry): boolean {
  if (previous.speaker !== next.speaker) {
    return false;
  }

  const gapMs = Math.max(0, next.createdAt - previous.createdAt);
  if (gapMs > 8000) {
    return false;
  }

  const previousText = previous.text.trim();
  const nextText = next.text.trim();
  if (!previousText || !nextText) {
    return false;
  }

  if (nextText.startsWith(previousText) || previousText.startsWith(nextText)) {
    return true;
  }

  if (gapMs <= 2500) {
    return true;
  }

  return !/[.!?…]\s*$/u.test(previousText);
}

function joinTranscriptChunk(previous: string, next: string): string {
  const previousTrimmed = previous.trimEnd();
  const nextTrimmed = next.trimStart();
  if (!previousTrimmed) {
    return nextTrimmed;
  }
  if (!nextTrimmed) {
    return previousTrimmed;
  }

  if (nextTrimmed.startsWith(previousTrimmed)) {
    return nextTrimmed;
  }
  if (previousTrimmed.startsWith(nextTrimmed)) {
    return previousTrimmed;
  }

  const glue = needsSpace(previousTrimmed, nextTrimmed) ? " " : "";
  return `${previousTrimmed}${glue}${nextTrimmed}`;
}

function needsSpace(previous: string, next: string): boolean {
  const previousTail = previous.charAt(previous.length - 1);
  const nextHead = next.charAt(0);
  if (!previousTail || !nextHead) {
    return false;
  }
  const noSpaceAfter = /[\s([{"'—-]/u;
  const noSpaceBefore = /[\s.,!?;:)\]}%"'…]/u;
  return !noSpaceAfter.test(previousTail) && !noSpaceBefore.test(nextHead);
}
