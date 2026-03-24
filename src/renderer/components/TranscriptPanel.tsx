import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TranscriptEntry } from "@shared/types/transcript";
import { useI18n } from "@renderer/i18n/useI18n";

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  composer?: ReactNode;
}

interface DisplayMessage {
  id: string;
  speaker: TranscriptEntry["speaker"];
  text: string;
  thoughtText: string | null;
}

export function TranscriptPanel({ entries, composer }: TranscriptPanelProps) {
  const { copy, locale } = useI18n();
  const finalModelEntries = entries.filter(
    (entry) =>
      entry.speaker === "model" && entry.status === "final" && entry.text.trim().length > 0
  );
  const displayMessages = useMemo(
    () => combineModelEntries(finalModelEntries),
    [finalModelEntries]
  );

  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAutoScrollEnabled, setHistoryAutoScrollEnabled] = useState(true);
  const historyThreadRef = useRef<HTMLDivElement>(null);

  const latestMessage = displayMessages.at(-1) ?? null;
  const previousMessage =
    displayMessages.length > 1 ? displayMessages[displayMessages.length - 2] : null;

  const labels = useMemo(
    () =>
      locale === "ru"
        ? {
            thinkingCollapsed: "Думает...",
            thinkingExpandHint: "Нажмите, чтобы раскрыть мысли",
            historyTitle: "История чата",
            closeHistory: "Закрыть",
            openHistory: "Открыть историю",
            waitingAnswer: "Ответ формируется..."
          }
        : {
            thinkingCollapsed: "Thinking...",
            thinkingExpandHint: "Click to expand thoughts",
            historyTitle: "Chat history",
            closeHistory: "Close",
            openHistory: "Open history",
            waitingAnswer: "Answer is being generated..."
          },
    [locale]
  );

  useEffect(() => {
    if (!historyOpen) {
      return;
    }
    const node = historyThreadRef.current;
    if (!node || !historyAutoScrollEnabled) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [displayMessages, historyAutoScrollEnabled, historyOpen]);

  useEffect(() => {
    if (!historyOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  function openHistory(): void {
    setHistoryAutoScrollEnabled(true);
    setHistoryOpen(true);
  }

  function onHistoryScroll(): void {
    const node = historyThreadRef.current;
    if (!node) {
      return;
    }
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setHistoryAutoScrollEnabled(distanceToBottom < 28);
  }

  function toggleThought(messageId: string): void {
    setExpandedThoughts((state) => ({
      ...state,
      [messageId]: !state[messageId]
    }));
  }

  return (
    <section className="transcript-panel">
      <div className="transcript-panel-body">
        <div className="transcript-focus-area" aria-live="polite">
          {!latestMessage ? (
            <div className="transcript-empty">
              <div className="empty-state-copy">...</div>
            </div>
          ) : (
            <div className="transcript-focus-stack">
              {previousMessage ? (
                <button
                  type="button"
                  className="transcript-focus-card transcript-focus-card-previous"
                  onClick={openHistory}
                  aria-label={labels.openHistory}
                >
                  <span className="transcript-message-meta">
                    {copy.transcript.speaker[previousMessage.speaker]}
                  </span>
                  <div className="transcript-message-content">
                    {previousMessage.thoughtText ? (
                      <div className="transcript-inline-thinking">
                        <span className="transcript-inline-thinking-label">
                          {labels.thinkingCollapsed}
                        </span>
                      </div>
                    ) : null}
                    <p className="transcript-message-text">
                      {truncateText(previousMessage.text || labels.waitingAnswer, 170)}
                    </p>
                  </div>
                </button>
              ) : null}
              <button
                type="button"
                className={`transcript-focus-card transcript-focus-card-current${
                  latestMessage.thoughtText ? " is-thought" : ""
                }`}
                onClick={openHistory}
                aria-label={labels.openHistory}
              >
                <span className="transcript-message-meta">
                  {copy.transcript.speaker[latestMessage.speaker]}
                </span>
                <div className="transcript-message-content">
                  {latestMessage.thoughtText ? (
                    <div className="transcript-inline-thinking">
                      <span className="transcript-inline-thinking-label">
                        {labels.thinkingCollapsed}
                      </span>
                    </div>
                  ) : null}
                  <p className="transcript-message-text">
                    {latestMessage.text || labels.waitingAnswer}
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
        {composer ?? null}
      </div>

      {historyOpen ? (
        <div className="transcript-modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <article className="transcript-modal" onClick={(event) => event.stopPropagation()}>
            <header className="transcript-modal-header">
              <span>{labels.historyTitle}</span>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setHistoryOpen(false)}
              >
                {labels.closeHistory}
              </button>
            </header>
            <div
              ref={historyThreadRef}
              className="transcript-history-thread"
              onScroll={onHistoryScroll}
            >
              {displayMessages.map((message) => {
                const thoughtExpanded = Boolean(expandedThoughts[message.id]);
                return (
                  <div
                    key={message.id}
                    className={`transcript-message transcript-message-${message.speaker} is-final${
                      message.thoughtText ? " is-thought" : ""
                    }`}
                  >
                    <div className="transcript-message-meta">
                      <span>{copy.transcript.speaker[message.speaker]}</span>
                    </div>
                    <div className="transcript-message-bubble transcript-history-combined-bubble">
                      {message.thoughtText ? (
                        <button
                          type="button"
                          className="transcript-history-thought-toggle"
                          onClick={() => toggleThought(message.id)}
                        >
                          <span className="transcript-thought-label">
                            {labels.thinkingCollapsed}
                          </span>
                          <span className="transcript-thought-hint">
                            {labels.thinkingExpandHint}
                          </span>
                        </button>
                      ) : null}
                      {message.thoughtText && thoughtExpanded ? (
                        <div className="transcript-history-thought-text">
                          {message.thoughtText}
                        </div>
                      ) : null}
                      <p className="transcript-message-text">
                        {message.text || labels.waitingAnswer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function combineModelEntries(entries: TranscriptEntry[]): DisplayMessage[] {
  const messages: DisplayMessage[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index];
    if (!current) {
      continue;
    }

    if (!current.thought) {
      messages.push({
        id: current.id,
        speaker: current.speaker,
        text: current.text,
        thoughtText: null
      });
      continue;
    }

    const thoughtChunks = [current.text];
    let cursor = index + 1;
    while (cursor < entries.length && entries[cursor]?.thought) {
      const chunk = entries[cursor]?.text ?? "";
      if (chunk.trim().length > 0) {
        thoughtChunks.push(chunk);
      }
      cursor += 1;
    }

    const candidateAnswer = entries[cursor];
    if (candidateAnswer && !candidateAnswer.thought) {
      messages.push({
        id: candidateAnswer.id,
        speaker: candidateAnswer.speaker,
        text: candidateAnswer.text,
        thoughtText: thoughtChunks.filter(Boolean).join("\n\n")
      });
      index = cursor;
      continue;
    }

    messages.push({
      id: current.id,
      speaker: current.speaker,
      text: "",
      thoughtText: thoughtChunks.filter(Boolean).join("\n\n")
    });
    index = cursor - 1;
  }

  return messages;
}
