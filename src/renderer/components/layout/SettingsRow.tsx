import type { ReactNode } from "react";
import { HelpTooltip } from "@renderer/components/ui/HelpTooltip";

export function SettingsRow({
  label,
  helpText,
  helpAriaLabel,
  warningText,
  warningAriaLabel,
  description,
  control,
  className,
  muted = false
}: {
  label: string;
  helpText?: ReactNode;
  helpAriaLabel?: string;
  warningText?: ReactNode;
  warningAriaLabel?: string;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  const composedClassName = [
    "settings-row",
    className,
    muted ? "settings-row-muted" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={composedClassName}>
      <div className="settings-row-copy">
        <div className="settings-row-label">
          <span>{label}</span>
          {helpText ? (
            <HelpTooltip
              content={helpText}
              ariaLabel={helpAriaLabel ?? `${label} description`}
            />
          ) : null}
          {warningText ? (
            <HelpTooltip
              content={warningText}
              ariaLabel={warningAriaLabel ?? `${label} unavailable`}
              variant="warning"
            />
          ) : null}
        </div>
        {description ? <div className="settings-row-description">{description}</div> : null}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
