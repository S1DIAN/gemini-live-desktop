import { useEffect, useState } from "react";
import { useI18n } from "@renderer/i18n/useI18n";
import { PauseIcon, PlayIcon } from "@renderer/components/ui/Icons";
import { useSettingsStore } from "@renderer/state/settingsStore";
import {
  voicePreviewPlayer,
  type VoicePreviewState
} from "@renderer/services/audio/voicePreviewPlayer";

interface VoicePreviewButtonProps {
  voiceName: string;
  disabled?: boolean;
  compact?: boolean;
  onError?: (error: unknown) => void;
}

export function VoicePreviewButton({
  voiceName,
  disabled = false,
  compact = false,
  onError
}: VoicePreviewButtonProps) {
  const { copy, locale } = useI18n();
  const modelVolume = useSettingsStore((state) => state.settings.audio.modelVolume);
  const [state, setState] = useState<VoicePreviewState>(voicePreviewPlayer.getState());
  const sameVoice = state.voiceName === voiceName;
  const isLoading = sameVoice && state.status === "loading";
  const isPlaying = sameVoice && state.status === "playing";

  useEffect(() => voicePreviewPlayer.subscribe(setState), []);
  useEffect(() => {
    voicePreviewPlayer.setVolume(modelVolume);
  }, [modelVolume]);

  const className = compact
    ? `button-secondary voice-preview-button voice-preview-button-compact${isPlaying ? " active" : ""}`
    : `button-secondary voice-preview-button${isPlaying ? " active" : ""}`;
  const title = isLoading
    ? copy.settings.voicePreview.loading
    : isPlaying
      ? copy.settings.voicePreview.pause
      : copy.settings.voicePreview.play;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || isLoading}
      title={title}
      aria-label={title}
      onClick={() =>
        void voicePreviewPlayer
          .togglePreview({
            voiceName,
            speechLanguageCode: locale === "ru" ? "ru" : "en"
          })
          .catch((error) => onError?.(error))
      }
    >
      {isLoading ? (
        <span className="voice-preview-loading-dot" aria-hidden="true" />
      ) : isPlaying ? (
        <PauseIcon size={14} />
      ) : (
        <PlayIcon size={14} />
      )}
    </button>
  );
}
