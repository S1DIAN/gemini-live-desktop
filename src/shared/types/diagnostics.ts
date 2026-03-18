export type DiagnosticsLevel = "debug" | "info" | "warn" | "error";
export type DiagnosticsCategory =
  | "session"
  | "capability"
  | "media"
  | "audio"
  | "proactive"
  | "worker"
  | "storage";

export interface DiagnosticsEvent {
  id: string;
  timestamp: number;
  event?: string;
  turnId?: string;
  sessionId?: string;
  level: DiagnosticsLevel;
  category: DiagnosticsCategory;
  message: string;
  details?: Record<string, unknown>;
}
