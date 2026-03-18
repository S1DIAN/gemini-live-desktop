import { useState } from "react";
import type { SessionStatus } from "@shared/types/live";
import { hasLiveSession } from "@renderer/state/sessionStatus";
import { useI18n } from "@renderer/i18n/useI18n";
import type { TranslationDictionary } from "@renderer/i18n/translations";

interface SessionControlsProps {
  status: SessionStatus;
  connectConfigLocked: boolean;
  lastError: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  mediaControlsEnabled: boolean;
  onConnect: () => Promise<void>;
  onPause: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleMic: () => Promise<void>;
  onToggleCamera: () => Promise<void>;
  onToggleScreen: () => Promise<void>;
  onStopPlayback: () => void;
  onError: (error: unknown) => void;
}

export function SessionControls(props: SessionControlsProps) {
  const { copy } = useI18n();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "connect" | "pause" | "disconnect" | "mic" | "camera" | "screen" | null
  >(null);
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

  const statusCopy = getStatusCopy(props.status, props.lastError, copy);
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
    <div className="panel controls">
      <div className="status-row">
        <span className={`status-pill status-${props.status}`}>
          {copy.sessionControls.statuses[props.status]}
        </span>
        <span className="status-copy">{statusCopy}</span>
      </div>
      <div className="button-grid">
        {sessionActive ? (
          <>
            <button
              className={busyAction === "pause" ? "button-pending" : ""}
              disabled={busy}
              onClick={() => void run("pause", props.onPause)}
            >
              {pauseLabel}
            </button>
            <button
              className={busyAction === "disconnect" ? "button-pending" : ""}
              disabled={busy}
              onClick={() => void run("disconnect", props.onDisconnect)}
            >
              {disconnectLabel}
            </button>
          </>
        ) : pausedWithRetainedConfig ? (
          <>
            <button
              className={busyAction === "connect" ? "button-pending" : ""}
              disabled={busy}
              onClick={() => void run("connect", props.onConnect)}
            >
              {connectLabel}
            </button>
            <button
              className={busyAction === "disconnect" ? "button-pending" : ""}
              disabled={busy}
              onClick={() => void run("disconnect", props.onDisconnect)}
            >
              {disconnectLabel}
            </button>
          </>
        ) : (
          <button
            className={busyAction === "connect" ? "button-pending" : ""}
            disabled={busy}
            onClick={() => void run("connect", props.onConnect)}
          >
            {connectLabel}
          </button>
        )}
        <button
          className={busyAction === "mic" ? "button-pending" : ""}
          disabled={busy || !props.mediaControlsEnabled}
          onClick={() => void run("mic", props.onToggleMic)}
        >
          {copy.sessionControls.mic}{" "}
          {props.micEnabled ? copy.common.off : copy.common.on}
        </button>
        <button
          className={busyAction === "camera" ? "button-pending" : ""}
          disabled={busy || !props.mediaControlsEnabled}
          onClick={() => void run("camera", props.onToggleCamera)}
        >
          {copy.sessionControls.cam}{" "}
          {props.cameraEnabled ? copy.common.off : copy.common.on}
        </button>
        <button
          className={busyAction === "screen" ? "button-pending" : ""}
          disabled={busy || !props.mediaControlsEnabled}
          onClick={() => void run("screen", props.onToggleScreen)}
        >
          {copy.sessionControls.screen}{" "}
          {props.screenEnabled ? copy.common.off : copy.common.on}
        </button>
        <button disabled={busy} onClick={props.onStopPlayback}>
          {copy.sessionControls.stopPlayback}
        </button>
      </div>
    </div>
  );
}

function getStatusCopy(
  status: SessionStatus,
  lastError: string,
  copy: TranslationDictionary
): string {
  switch (status) {
    case "connecting":
      return copy.sessionControls.statusCopy.connecting;
    case "connected":
      return copy.sessionControls.statusCopy.connected;
    case "disconnecting":
      return copy.sessionControls.statusCopy.disconnecting;
    case "reconnecting":
      return copy.sessionControls.statusCopy.reconnecting;
    case "error":
      return lastError || copy.sessionControls.statusCopy.defaultError;
    case "disconnected":
      return copy.sessionControls.statusCopy.disconnected;
    case "idle":
    default:
      return copy.sessionControls.statusCopy.idle;
  }
}
