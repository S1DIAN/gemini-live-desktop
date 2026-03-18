import type { ReactNode } from "react";

export function SettingsRow({
  label,
  description,
  control
}: {
  label: string;
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <div className="settings-row-label">{label}</div>
        {description ? <div className="settings-row-description">{description}</div> : null}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}
