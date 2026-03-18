import { useState, type RefObject } from "react";
import type { SessionStatus } from "@shared/types/live";
import { hasLiveSession } from "@renderer/state/sessionStatus";
import { useI18n } from "@renderer/i18n/useI18n";
import { CameraIcon, MicIcon, ScreenIcon } from "@renderer/components/ui/Icons";
import { ScreenPreview } from "@renderer/components/ScreenPreview";
import { CameraPreview } from "@renderer/components/CameraPreview";

interface SourceOption {
  id: string;
  label: string;
}

interface SessionControlsProps {
  status: SessionStatus;
  connectConfigLocked: boolean;
  lastError: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  mediaControlsEnabled: boolean;
  previewEnabled: boolean;
  cameraSources: SourceOption[];
  screenSources: SourceOption[];
  screenPreviewRef: RefObject<HTMLVideoElement | null>;
  cameraPreviewRef: RefObject<HTMLVideoElement | null>;
  onConnect: () => Promise<void>;
  onPause: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleMic: () => Promise<void>;
  onStopCamera: () => Promise<void>;
  onStopScreen: () => Promise<void>;
  onStartCameraWithSource: (sourceId: string) => Promise<void>;
  onStartScreenWithSource: (sourceId: string) => Promise<void>;
  onError: (error: unknown) => void;
}

export function SessionControls(props: SessionControlsProps) {
  const { copy } = useI18n();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "connect" | "pause" | "disconnect" | "mic" | "camera" | "screen" | null
  >(null);
  const [openPicker, setOpenPicker] = useState<"camera" | "screen" | null>(null);
  const sessionActive = hasLiveSession(props.status);
  const pausedWithRetainedConfig =
    props.status === "disconnected" && props.connectConfigLocked;

  async function run(
    action: "connect" | "pause" | "disconnect" | "mic" | "camera" | "screen",
    task: () => Promise<void>
  ) {
    setBusy(true);
    setBusyAction(action);
    try {
      await task();
    } catch (error) {
      props.onError(error);
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  const connectLabel =
    busy && busyAction === "connect"
      ? copy.sessionControls.connecting
      : copy.sessionControls.connect;
  const pauseLabel =
    busy && busyAction === "pause"
      ? copy.sessionControls.pausing
      : copy.sessionControls.pause;
  const disconnectLabel =
    busy && busyAction === "disconnect"
      ? copy.sessionControls.disconnecting
      : copy.sessionControls.disconnect;

  return (
    <section className="session-dock">
      <div className="session-dock-status">
        <span className={`status-pill status-${props.status}`}>
          {copy.sessionControls.statuses[props.status]}
        </span>
      </div>

      <div className="session-dock-control-bar">
        <div className="session-dock-primary">
          {sessionActive ? (
            <>
              <button
                className={`dock-action-button ${busyAction === "pause" ? "button-pending" : "button-secondary"}`}
                disabled={busy}
                onClick={() => void run("pause", props.onPause)}
              >
                {pauseLabel}
              </button>
              <button
                className={`dock-action-button ${busyAction === "disconnect" ? "button-pending" : "button-primary"}`}
                disabled={busy}
                onClick={() => void run("disconnect", props.onDisconnect)}
              >
                {disconnectLabel}
              </button>
            </>
          ) : pausedWithRetainedConfig ? (
            <>
              <button
                className={`dock-action-button ${busyAction === "connect" ? "button-pending" : "button-primary"}`}
                disabled={busy}
                onClick={() => void run("connect", props.onConnect)}
              >
                {connectLabel}
              </button>
              <button
                className={`dock-action-button ${busyAction === "disconnect" ? "button-pending" : "button-secondary"}`}
                disabled={busy}
                onClick={() => void run("disconnect", props.onDisconnect)}
              >
                {disconnectLabel}
              </button>
            </>
          ) : (
            <button
              className={`dock-action-button dock-action-button-wide ${busyAction === "connect" ? "button-pending" : "button-primary"}`}
              disabled={busy}
              onClick={() => void run("connect", props.onConnect)}
            >
              {connectLabel}
            </button>
          )}
        </div>

        <div className="session-dock-actions">
          {props.previewEnabled ? (
            <div className="session-dock-floating-previews">
              <ScreenPreview
                ref={props.screenPreviewRef}
                compact
                active={props.screenEnabled}
              />
              <CameraPreview
                ref={props.cameraPreviewRef}
                compact
                active={props.cameraEnabled}
              />
            </div>
          ) : null}
          <button
            type="button"
            className={props.micEnabled ? "dock-icon-button active" : "dock-icon-button"}
            title={`Mic ${props.micEnabled ? copy.common.on : copy.common.off}`}
            disabled={busy || !props.mediaControlsEnabled}
            onClick={() => void run("mic", props.onToggleMic)}
          >
            <MicIcon size={15} />
          </button>

          <div className="dock-picker-wrap">
            <button
              type="button"
              className={props.cameraEnabled ? "dock-icon-button active" : "dock-icon-button"}
              title={`Camera ${props.cameraEnabled ? copy.common.on : copy.common.off}`}
              disabled={busy || !props.mediaControlsEnabled}
              onClick={() => {
                if (props.cameraEnabled) {
                  void run("camera", props.onStopCamera);
                  return;
                }
                setOpenPicker((current) => (current === "camera" ? null : "camera"));
              }}
            >
              <CameraIcon size={15} />
            </button>
            {openPicker === "camera" ? (
              <div className="dock-picker">
                {props.cameraSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className="dock-picker-item"
                    onClick={() => {
                      setOpenPicker(null);
                      void run("camera", () => props.onStartCameraWithSource(source.id));
                    }}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dock-picker-wrap">
            <button
              type="button"
              className={props.screenEnabled ? "dock-icon-button active" : "dock-icon-button"}
              title={`Screen ${props.screenEnabled ? copy.common.on : copy.common.off}`}
              disabled={busy || !props.mediaControlsEnabled}
              onClick={() => {
                if (props.screenEnabled) {
                  void run("screen", props.onStopScreen);
                  return;
                }
                setOpenPicker((current) => (current === "screen" ? null : "screen"));
              }}
            >
              <ScreenIcon size={15} />
            </button>
            {openPicker === "screen" ? (
              <div className="dock-picker">
                {props.screenSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className="dock-picker-item"
                    onClick={() => {
                      setOpenPicker(null);
                      void run("screen", () => props.onStartScreenWithSource(source.id));
                    }}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
