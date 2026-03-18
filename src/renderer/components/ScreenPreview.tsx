import { forwardRef } from "react";
import { useI18n } from "@renderer/i18n/useI18n";

export const ScreenPreview = forwardRef<
  HTMLVideoElement,
  { compact?: boolean; active?: boolean }
>(function ScreenPreview({ compact = false, active = false }, ref) {
  const { copy } = useI18n();

  return (
    <div
      className={`panel preview-panel ${compact ? "preview-panel-compact" : ""} ${
        active ? "" : "preview-panel-hidden"
      }`}
    >
      {!compact ? <div className="panel-title">{copy.preview.screen}</div> : null}
      <video ref={ref} className="preview-video" autoPlay muted playsInline />
    </div>
  );
});
