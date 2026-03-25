import { useEffect, useState } from "react";
import { useI18n } from "@renderer/i18n/useI18n";
import {
  voicePreviewPlayer,
  type VoicePreviewState
} from "@renderer/services/audio/voicePreviewPlayer";

interface VoicePreviewButtonProps {
  voiceName: string;
  disabled?: boolean;
  compact?: boolean;
}

export function VoicePreviewButton({
  voiceName,
  disabled = false,
  compact = false
}: VoicePreviewButtonProps) {
  const { copy, locale } = useI18n();
  const [state, setState] = useState<VoicePreviewState>(voicePreviewPlayer.getState());
  const sameVoice = state.voiceName === voiceName;
  const isLoading = sameVoice && state.status === "loading";
  const isPlaying = sameVoice && state.status === "playing";

  useEffect(() => voicePreviewPlayer.subscribe(setState), []);

  const label = isLoading
    ? copy.settings.voicePreview.loading
    : isPlaying
      ? copy.settings.voicePreview.pause
      : copy.settings.voicePreview.play;
  const className = compact
    ? `button-secondary voice-preview-button voice-preview-button-compact${isPlaying ? " active" : ""}`
    : `button-secondary voice-preview-button${isPlaying ? " active" : ""}`;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || isLoading}
      onClick={() =>
        void voicePreviewPlayer
          .togglePreview({
            voiceName,
            speechLanguageCode: locale === "ru" ? "ru" : "en"
          })
          .catch(() => undefined)
      }
    >
      {label}
    </button>
  );
}
