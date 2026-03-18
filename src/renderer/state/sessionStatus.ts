import type { SessionStatus } from "@shared/types/live";

const LIVE_SESSION_STATUSES: SessionStatus[] = [
  "connecting",
  "connected",
  "reconnecting",
  "disconnecting"
];

export function hasLiveSession(status: SessionStatus): boolean {
  return LIVE_SESSION_STATUSES.includes(status);
}

export function areMediaControlsEnabled(status: SessionStatus): boolean {
  return status === "connected" || status === "reconnecting";
}

export function isConnectionBusy(status: SessionStatus): boolean {
  return status === "connecting" || status === "disconnecting";
}
