import type { TranscriptEntry } from "@shared/types/transcript";
import { useI18n } from "@renderer/i18n/useI18n";

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  const { copy } = useI18n();

  return (
    <div className="panel transcript-panel">
      <div className="panel-title">{copy.transcript.title}</div>
      <div className="transcript-list">
        {entries.map((entry) => (
          <article key={entry.id} className={`transcript-entry ${entry.speaker}`}>
            <header>
              <strong>{copy.transcript.speaker[entry.speaker]}</strong>
              <span>{copy.transcript.status[entry.status]}</span>
            </header>
            <p>{entry.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
