import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { useI18n } from "@renderer/i18n/useI18n";
import { PageHeader } from "@renderer/components/layout/PageHeader";
import { ExportIcon } from "@renderer/components/ui/Icons";

export function DiagnosticsPage() {
  const { copy } = useI18n();
  const { events, effectiveConfig } = useDiagnosticsStore();
  const errorCount = events.filter((e) => e.level === "error").length;
  const warnCount = events.filter((e) => e.level === "warn").length;
  const latestEvent = events[0] ?? null;

  return (
    <section className="page diagnostics-page">
      <PageHeader
        title={copy.diagnostics.title}
        subtitle={copy.diagnostics.subtitle}
        meta={copy.diagnostics.meta}
        actions={
          <button
            className="button-primary"
            onClick={() => void window.appApi.diagnostics.exportLogs()}
          >
            <ExportIcon />
            {copy.diagnostics.exportLogs}
          </button>
        }
      />

      {/* Stat cards row — Stitch style */}
      <div className="diag-stat-row">
        <article className="diag-stat-card">
          <div className="diag-stat-label">{copy.diagnostics.summaryKeys.totalEvents}</div>
          <div className="diag-stat-value">{events.length}</div>
        </article>
        <article className="diag-stat-card diag-stat-card--error">
          <div className="diag-stat-label">{copy.diagnostics.summaryKeys.errorCount}</div>
          <div className="diag-stat-value">{errorCount}</div>
        </article>
        <article className="diag-stat-card diag-stat-card--warn">
          <div className="diag-stat-label">{copy.diagnostics.summaryKeys.warnCount}</div>
          <div className="diag-stat-value">{warnCount}</div>
        </article>
      </div>

      <div className="diag-body">
        {/* Left column: status + effective config */}
        <div className="diag-left">
          <div className="diag-panel">
            <div className="diag-panel-header">
              <span className="diag-panel-title">{copy.diagnostics.latestStatus}</span>
              {latestEvent ? (
                <span className={`diag-level-badge diag-level-badge--${latestEvent.level}`}>
                  {latestEvent.level.toUpperCase()}
                </span>
              ) : null}
            </div>
            <div className="diag-panel-body">
              {latestEvent ? (
                <>
                  <div className="diag-event-message">{latestEvent.message}</div>
                  <div className="diag-event-category">{latestEvent.category}</div>
                </>
              ) : (
                <div className="diag-empty">{copy.diagnostics.noDiagnosticsYet}</div>
              )}
              <pre className="diag-code">
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

          <div className="diag-panel">
            <div className="diag-panel-header">
              <span className="diag-panel-title">{copy.diagnostics.effectiveSessionSnapshot}</span>
            </div>
            <div className="diag-panel-body">
              <pre className="diag-code">
                {JSON.stringify(
                  effectiveConfig ?? {
                    [copy.diagnostics.summaryKeys.message]: copy.diagnostics.noEffectiveConfigYet
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>

        {/* Right column: event timeline table */}
        <div className="diag-right">
          <div className="diag-panel diag-panel--full">
            <div className="diag-panel-header">
              <span className="diag-panel-title">{copy.diagnostics.eventTimeline}</span>
              <span className="diag-event-count">
                {events.length} {copy.diagnostics.eventCountSuffix}
              </span>
            </div>
            <div className="diag-table-wrap">
              {events.length === 0 ? (
                <div className="diag-empty diag-empty--centered">
                  {copy.diagnostics.noDiagnosticsYet}
                </div>
              ) : (
                <table className="diag-table">
                  <thead>
                    <tr>
                      <th>{copy.diagnostics.tableHeaders.level}</th>
                      <th>{copy.diagnostics.tableHeaders.category}</th>
                      <th>{copy.diagnostics.tableHeaders.message}</th>
                      <th>{copy.diagnostics.tableHeaders.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className={`diag-row diag-row--${event.level}`}>
                        <td>
                          <span className={`diag-level-badge diag-level-badge--${event.level}`}>
                            {event.level.toUpperCase()}
                          </span>
                        </td>
                        <td className="diag-cell-category">{event.category}</td>
                        <td className="diag-cell-message">
                          <div>{event.message}</div>
                          {event.details ? (
                            <pre className="diag-code diag-code--inline">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          ) : null}
                        </td>
                        <td className="diag-cell-time">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
