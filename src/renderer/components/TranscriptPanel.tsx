import { useEffect, useRef, type ReactNode } from "react";
import type { TranscriptEntry } from "@shared/types/transcript";
import { useI18n } from "@renderer/i18n/useI18n";

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  composer?: ReactNode;
}

export function TranscriptPanel({ entries, composer }: TranscriptPanelProps) {
  const { copy } = useI18n();
  const displayEntries = entries.filter(
    (entry) =>
      entry.speaker === "model" && entry.status === "final" && entry.text.trim().length > 0
  );
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
