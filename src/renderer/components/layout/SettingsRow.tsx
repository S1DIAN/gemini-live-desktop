import type { ReactNode } from "react";
import { HelpTooltip } from "@renderer/components/ui/HelpTooltip";

export function SettingsRow({
  label,
  helpText,
  helpAriaLabel,
  description,
  control,
  className
}: {
  label: string;
  helpText?: ReactNode;
  helpAriaLabel?: string;
  description?: ReactNode;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `settings-row ${className}` : "settings-row"}>
      <div className="settings-row-copy">
        <div className="settings-row-label">
          <span>{label}</span>
          {helpText ? (
            <HelpTooltip
              content={helpText}
              ariaLabel={helpAriaLabel ?? `${label} description`}
            />
          ) : null}
        </div>
        {description ? <div className="settings-row-description">{description}</div> : null}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
