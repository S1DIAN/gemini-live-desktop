import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { useI18n } from "@renderer/i18n/useI18n";

export function DiagnosticsPage() {
  const { copy } = useI18n();
  const { events, effectiveConfig } = useDiagnosticsStore();
  const errorCount = events.filter((event) => event.level === "error").length;
  const warnCount = events.filter((event) => event.level === "warn").length;
  const latestEvent = events[0] ?? null;

  return (
    <section className="page diagnostics-page">
      <div className="page-header">
        <h1>{copy.diagnostics.title}</h1>
        <button onClick={() => void window.appApi.diagnostics.exportLogs()}>
          {copy.diagnostics.exportLogs}
        </button>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-title">{copy.diagnostics.summary}</div>
          <pre>
            {JSON.stringify(
              {
                [copy.diagnostics.summaryKeys.totalEvents]: events.length,
                [copy.diagnostics.summaryKeys.errorCount]: errorCount,
                [copy.diagnostics.summaryKeys.warnCount]: warnCount,
                [copy.diagnostics.summaryKeys.latestEvent]: latestEvent
                  ? {
                      [copy.diagnostics.summaryKeys.category]: latestEvent.category,
                      [copy.diagnostics.summaryKeys.level]: latestEvent.level,
                      [copy.diagnostics.summaryKeys.message]: latestEvent.message,
                      [copy.diagnostics.summaryKeys.timestamp]: new Date(
                        latestEvent.timestamp
                      ).toISOString()
                    }
                  : null
              },
              null,
              2
            )}
          </pre>
        </div>
        <div className="panel">
          <div className="panel-title">{copy.diagnostics.latestStatus}</div>
          <pre>
            {JSON.stringify(
              latestEvent
                ? {
                    [copy.diagnostics.summaryKeys.category]: latestEvent.category,
                    [copy.diagnostics.summaryKeys.level]: latestEvent.level,
                    [copy.diagnostics.summaryKeys.message]: latestEvent.message,
                    [copy.diagnostics.summaryKeys.details]: latestEvent.details ?? null
                  }
                : { [copy.diagnostics.summaryKeys.message]: copy.diagnostics.noDiagnosticsYet },
              null,
              2
            )}
          </pre>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{copy.diagnostics.effectiveSessionSnapshot}</div>
        <pre>
          {JSON.stringify(
            effectiveConfig ?? { [copy.diagnostics.summaryKeys.message]: copy.diagnostics.noEffectiveConfigYet },
            null,
            2
          )}
        </pre>
      </div>

      <div className="panel diagnostics-log">
        <div className="panel-title">{copy.diagnostics.eventTimeline}</div>
        <div className="log-list">
          {events.map((event) => (
            <article key={event.id} className={`log-entry ${event.level}`}>
              <header>
                <strong>{event.category}</strong>
                <span>{new Date(event.timestamp).toLocaleString()}</span>
              </header>
              <p>
                <strong>{event.level.toUpperCase()}</strong>
              </p>
              <p>{event.message}</p>
              {event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
