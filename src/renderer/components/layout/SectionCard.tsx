import type { ReactNode } from "react";
import { HelpTooltip } from "@renderer/components/ui/HelpTooltip";

export function SectionCard({
  title,
  helpText,
  helpAriaLabel,
  description,
  actions,
  children
}: {
  title: string;
  helpText?: ReactNode;
  helpAriaLabel?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card-header">
        <div>
          <div className="section-card-title-row">
            <h2 className="section-card-title">{title}</h2>
            {helpText ? (
              <HelpTooltip
                content={helpText}
                ariaLabel={helpAriaLabel ?? `${title} description`}
              />
            ) : null}
          </div>
          {description ? <p className="section-card-description">{description}</p> : null}
        </div>
        {actions ? <div className="section-card-actions">{actions}</div> : null}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
