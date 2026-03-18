import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { useI18n } from "@renderer/i18n/useI18n";
import { PageHeader } from "@renderer/components/layout/PageHeader";
import { SectionCard } from "@renderer/components/layout/SectionCard";
import { ActivityIcon, ExportIcon } from "@renderer/components/ui/Icons";

export function DiagnosticsPage() {
  const { copy } = useI18n();
  const { events, effectiveConfig } = useDiagnosticsStore();
  const errorCount = events.filter((event) => event.level === "error").length;
  const warnCount = events.filter((event) => event.level === "warn").length;
  const latestEvent = events[0] ?? null;

  return (
    <section className="page diagnostics-page">
      <PageHeader
        title={copy.diagnostics.title}
        subtitle="Compact support view for the last session state, key failures and raw event trail."
        meta="Support"
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

      <div className="diagnostics-layout">
        <div className="diagnostics-rail">
          <SectionCard title="Overview" description="High-signal counters for the current app run.">
            <div className="diagnostics-summary-grid">
              <article className="summary-stat-card">
                <div className="summary-stat-label">{copy.diagnostics.summaryKeys.totalEvents}</div>
                <strong>{events.length}</strong>
              </article>
              <article className="summary-stat-card">
                <div className="summary-stat-label">{copy.diagnostics.summaryKeys.errorCount}</div>
                <strong>{errorCount}</strong>
              </article>
              <article className="summary-stat-card">
                <div className="summary-stat-label">{copy.diagnostics.summaryKeys.warnCount}</div>
                <strong>{warnCount}</strong>
              </article>
            </div>
          </SectionCard>

          <SectionCard title={copy.diagnostics.latestStatus}>
            <div className="diagnostics-latest-card">
              <ActivityIcon size={18} />
              <div className="diagnostics-latest-copy">
                <strong>{latestEvent?.message ?? copy.diagnostics.noDiagnosticsYet}</strong>
                <span>{latestEvent?.category ?? "session"}</span>
              </div>
            </div>
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
          </SectionCard>

          <SectionCard title={copy.diagnostics.effectiveSessionSnapshot}>
            <pre>
              {JSON.stringify(
                effectiveConfig ?? {
                  [copy.diagnostics.summaryKeys.message]: copy.diagnostics.noEffectiveConfigYet
                },
                null,
                2
              )}
            </pre>
          </SectionCard>
        </div>

        <SectionCard title={copy.diagnostics.eventTimeline}>
          <div className="log-list">
            {events.length === 0 ? (
              <div className="empty-state compact">
                <div className="empty-state-title">{copy.diagnostics.title}</div>
                <div className="empty-state-copy">{copy.diagnostics.noDiagnosticsYet}</div>
              </div>
            ) : null}
            {events.map((event) => (
              <article key={event.id} className={`log-entry ${event.level}`}>
                <header>
                  <strong>{event.category}</strong>
                  <span>{new Date(event.timestamp).toLocaleString()}</span>
                </header>
                <p className="log-entry-level">{event.level.toUpperCase()}</p>
                <p>{event.message}</p>
                {event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
