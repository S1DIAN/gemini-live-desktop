import type { ApiVersion, ProactiveMode } from "@shared/types/settings";
import { useI18n } from "@renderer/i18n/useI18n";
import { SectionCard } from "@renderer/components/layout/SectionCard";

export function ProactiveModeSwitch({
  value,
  onChange,
  disabled = false,
  requestedApiVersion,
  runtimeApiVersion,
  errorText,
  compact = false
}: {
  value: ProactiveMode;
  onChange: (value: ProactiveMode) => void;
  disabled?: boolean;
  requestedApiVersion: ApiVersion;
  runtimeApiVersion: ApiVersion | null;
  errorText?: string;
  compact?: boolean;
}) {
  const { copy } = useI18n();

  const content = (
    <>
      <div className="segmented-control">
        {(["off", "pure", "assisted"] as ProactiveMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={mode === value ? "active" : ""}
            disabled={disabled}
            onClick={() => onChange(mode)}
          >
            {copy.proactiveMode.modes[mode]}
          </button>
        ))}
      </div>
      <div className="proactive-api-status">
        <div className="proactive-api-row">
          <span>{copy.proactiveMode.requestedApi}</span>
          <strong>{requestedApiVersion}</strong>
        </div>
        <div className="proactive-api-row">
          <span>{copy.proactiveMode.runtimeApi}</span>
          <strong>{runtimeApiVersion ?? copy.proactiveMode.notConnectedYet}</strong>
        </div>
        {errorText ? (
          <div className="proactive-api-error">
            {copy.proactiveMode.errorPrefix} {errorText}
          </div>
        ) : null}
      </div>
    </>
  );

  if (compact) {
    return <div className="proactive-switch-compact">{content}</div>;
  }

  return <SectionCard title={copy.proactiveMode.title}>{content}</SectionCard>;
}
