import { forwardRef } from "react";
import { useI18n } from "@renderer/i18n/useI18n";

export const CameraPreview = forwardRef<HTMLVideoElement>(function CameraPreview(
  _props,
  ref
) {
  const { copy } = useI18n();

  return (
    <div className="panel preview-panel">
      <div className="panel-title">{copy.preview.camera}</div>
      <video ref={ref} className="preview-video" autoPlay muted playsInline />
    </div>
  );
});
