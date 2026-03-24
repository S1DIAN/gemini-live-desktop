export type TranscriptSpeaker = "user" | "model" | "system";
export type TranscriptStatus = "partial" | "final";

export interface TranscriptEntry {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  status: TranscriptStatus;
  createdAt: number;
  thought?: boolean;
  thoughtSignature?: string;
}
