import { forwardRef } from "react";
import { useI18n } from "@renderer/i18n/useI18n";

export const ScreenPreview = forwardRef<HTMLVideoElement>(function ScreenPreview(
  _props,
  ref
) {
  const { copy } = useI18n();

  return (
    <div className="panel preview-panel">
      <div className="panel-title">{copy.preview.screen}</div>
      <video ref={ref} className="preview-video" autoPlay muted playsInline />
    </div>
  );
});
