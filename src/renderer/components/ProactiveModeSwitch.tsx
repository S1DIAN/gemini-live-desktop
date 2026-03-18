import type { ApiVersion, ProactiveMode } from "@shared/types/settings";
import { useI18n } from "@renderer/i18n/useI18n";

export function ProactiveModeSwitch({
  value,
  onChange,
  disabled = false,
  requestedApiVersion,
  runtimeApiVersion,
  errorText
}: {
  value: ProactiveMode;
  onChange: (value: ProactiveMode) => void;
  disabled?: boolean;
  requestedApiVersion: ApiVersion;
  runtimeApiVersion: ApiVersion | null;
  errorText?: string;
}) {
  const { copy } = useI18n();

  return (
    <div className="panel proactive-switch">
      <div className="panel-title">{copy.proactiveMode.title}</div>
      <div className="segmented">
        {(["off", "pure", "assisted"] as ProactiveMode[]).map((mode) => (
          <button
            key={mode}
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
    </div>
  );
}
