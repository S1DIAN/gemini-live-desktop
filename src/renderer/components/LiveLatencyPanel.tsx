import { useMemo } from "react";
import type { DiagnosticsEvent } from "@shared/types/diagnostics";
import type { SessionStatus } from "@shared/types/live";
import { useI18n } from "@renderer/i18n/useI18n";

interface LiveLatencyPanelProps {
  events: DiagnosticsEvent[];
  sessionStatus: SessionStatus;
  waitingForInput: boolean;
  userSpeaking: boolean;
  modelSpeaking: boolean;
}

const TURN_EVENT_ORDER = [
  "mic_first_frame_captured",
  "vad_speech_started",
  "vad_speech_ended",
  "user_turn_input_completed",
  "server_turn_ack_received",
  "server_turn_detected",
  "model_response_started",
  "first_model_audio_received",
  "playback_started",
  "playback_completed",
  "turn_aborted",
  "turn_latency_summary"
] as const;

const TURN_EVENT_SET = new Set<string>(TURN_EVENT_ORDER);

type Tone = "idle" | "active" | "pending" | "done" | "warn";

interface MetricRow {
  key:
    | "speechCaptured"
    | "commitToAck"
    | "detectToModelStart"
    | "modelStartToFirstAudio"
    | "firstAudioToPlayback"
    | "totalTurn";
  valueMs: number | null;
}

const TEXT = {
  en: {
    panelTitle: "Live Timing",
    turnLabel: "Turn",
    stage: {
      connecting: "Connecting",
      notConnected: "Not connected",
      turnAborted: "Turn aborted",
      turnComplete: "Turn complete",
      playingResponse: "Playing response",
      modelThinking: "Model thinking",
      waitingModel: "Waiting model response",
      recordingSpeech: "Recording speech",
      idle: "Idle"
    },
    metrics: {
      speechCaptured: "Speech captured",
      commitToAck: "Commit -> server ack",
      detectToModelStart: "Server detect -> model start",
      modelStartToFirstAudio: "Model start -> first audio",
      firstAudioToPlayback: "First audio -> playback",
      totalTurn: "Total turn"
    },
    checkpointsTitle: "Checkpoint Timeline",
    noTurn:
      "No voice turn yet. Start speaking to see live latency checkpoints.",
    missingHint:
      "Missing values mean this checkpoint was not emitted yet, or this response was not tied to a user voice turn.",
    checkpointLabels: {
      mic_first_frame_captured: "Mic first frame",
      vad_speech_started: "Speech detected",
      vad_speech_ended: "Speech ended",
      user_turn_input_completed: "Turn committed",
      server_turn_ack_received: "Server ack",
      server_turn_detected: "Server detected turn",
      model_response_started: "Model response started",
      first_model_audio_received: "First model audio",
      playback_started: "Playback started",
      playback_completed: "Playback completed",
      turn_aborted: "Turn aborted"
    }
  },
  ru: {
    panelTitle: "Задержки в реальном времени",
    turnLabel: "Ход",
    stage: {
      connecting: "Подключение",
      notConnected: "Не подключено",
      turnAborted: "Ход прерван",
      turnComplete: "Ход завершен",
      playingResponse: "Воспроизведение ответа",
      modelThinking: "Модель думает",
      waitingModel: "Ожидание ответа модели",
      recordingSpeech: "Идет запись речи",
      idle: "Ожидание"
    },
    metrics: {
      speechCaptured: "Длительность речи",
      commitToAck: "Коммит -> ack сервера",
      detectToModelStart: "Detect сервера -> старт модели",
      modelStartToFirstAudio: "Старт модели -> первый аудио-чанк",
      firstAudioToPlayback: "Первый аудио-чанк -> воспроизведение",
      totalTurn: "Полная длительность хода"
    },
    checkpointsTitle: "Лента чекпоинтов",
    noTurn:
      "Пока нет голосового хода. Начните говорить, чтобы увидеть тайминги.",
    missingHint:
      "Пропуски означают, что чекпоинт еще не пришел, либо этот ответ не был привязан к пользовательскому голосовому ходу.",
    checkpointLabels: {
      mic_first_frame_captured: "Первый фрейм микрофона",
      vad_speech_started: "Речь обнаружена",
      vad_speech_ended: "Речь закончилась",
      user_turn_input_completed: "Ход закоммичен",
      server_turn_ack_received: "Ack сервера",
      server_turn_detected: "Сервер распознал ход",
      model_response_started: "Модель начала ответ",
      first_model_audio_received: "Первый аудио-чанк модели",
      playback_started: "Начато воспроизведение",
      playback_completed: "Воспроизведение завершено",
      turn_aborted: "Ход прерван"
    }
  }
} as const;

export function LiveLatencyPanel({
  events,
  sessionStatus,
  waitingForInput,
  userSpeaking,
  modelSpeaking
}: LiveLatencyPanelProps) {
  const { locale } = useI18n();
  const text = locale === "ru" ? TEXT.ru : TEXT.en;

  const latestTurnId = useMemo(() => {
    const grouped = new Map<
      string,
      {
        latestTimestamp: number;
        hasSummary: boolean;
        hasPlaybackCompleted: boolean;
        eventCount: number;
      }
    >();

    for (const event of events) {
      if (!event.turnId || !event.event || !TURN_EVENT_SET.has(event.event)) {
        continue;
      }
      const current = grouped.get(event.turnId) ?? {
        latestTimestamp: 0,
        hasSummary: false,
        hasPlaybackCompleted: false,
        eventCount: 0
      };
      current.latestTimestamp = Math.max(current.latestTimestamp, event.timestamp);
      current.hasSummary = current.hasSummary || event.event === "turn_latency_summary";
      current.hasPlaybackCompleted =
        current.hasPlaybackCompleted || event.event === "playback_completed";
      current.eventCount += 1;
      grouped.set(event.turnId, current);
    }

    let bestTurnId: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const [turnId, info] of grouped.entries()) {
      const score =
        (info.hasSummary ? 1_000_000 : 0) +
        (info.hasPlaybackCompleted ? 100_000 : 0) +
        info.eventCount * 100 +
        info.latestTimestamp;
      if (score > bestScore) {
        bestScore = score;
        bestTurnId = turnId;
      }
    }
    return bestTurnId;
  }, [events]);

  const turnEvents = useMemo(() => {
    if (!latestTurnId) {
      return [] as DiagnosticsEvent[];
    }
    return events
      .filter(
        (event) =>
          event.turnId === latestTurnId &&
          event.event &&
          TURN_EVENT_SET.has(event.event)
      )
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [events, latestTurnId]);

  const byEvent = useMemo(() => {
    const map = new Map<string, DiagnosticsEvent>();
    for (const event of turnEvents) {
      if (event.event) {
        map.set(event.event, event);
      }
    }
    return map;
  }, [turnEvents]);

  const summaryDetails = useMemo(() => {
    const summaryEvent = byEvent.get("turn_latency_summary");
    return summaryEvent?.details ?? {};
  }, [byEvent]);

  const stage = useMemo((): { label: string; tone: Tone } => {
    if (sessionStatus === "connecting" || sessionStatus === "reconnecting") {
      return { label: text.stage.connecting, tone: "pending" };
    }
    if (sessionStatus !== "connected" && sessionStatus !== "disconnecting") {
      return { label: text.stage.notConnected, tone: "idle" };
    }
    if (byEvent.has("turn_aborted")) {
      return { label: text.stage.turnAborted, tone: "warn" };
    }
    if (byEvent.has("playback_completed")) {
      return { label: text.stage.turnComplete, tone: "done" };
    }
    if (modelSpeaking || byEvent.has("playback_started")) {
      return { label: text.stage.playingResponse, tone: "active" };
    }
    if (byEvent.has("model_response_started")) {
      return { label: text.stage.modelThinking, tone: "pending" };
    }
    if (byEvent.has("user_turn_input_completed") || waitingForInput) {
      return { label: text.stage.waitingModel, tone: "pending" };
    }
    if (userSpeaking || byEvent.has("vad_speech_started")) {
      return { label: text.stage.recordingSpeech, tone: "active" };
    }
    return { label: text.stage.idle, tone: "idle" };
  }, [
    byEvent,
    modelSpeaking,
    sessionStatus,
    text.stage,
    userSpeaking,
    waitingForInput
  ]);

  const metrics: MetricRow[] = [
    {
      key: "speechCaptured",
      valueMs:
        numberFromRecord(byEvent.get("user_turn_input_completed")?.details, "speechDurationMs") ??
        latency(
          byEvent.get("vad_speech_started")?.timestamp,
          byEvent.get("vad_speech_ended")?.timestamp
        )
    },
    {
      key: "commitToAck",
      valueMs:
        numberFromRecord(summaryDetails, "clientTurnCommitToServerAckMs") ??
        latency(
          byEvent.get("user_turn_input_completed")?.timestamp,
          byEvent.get("server_turn_ack_received")?.timestamp
        )
    },
    {
      key: "detectToModelStart",
      valueMs:
        numberFromRecord(summaryDetails, "serverTurnDetectedToModelStartMs") ??
        latency(
          byEvent.get("server_turn_detected")?.timestamp,
          byEvent.get("model_response_started")?.timestamp
        )
    },
    {
      key: "modelStartToFirstAudio",
      valueMs:
        numberFromRecord(summaryDetails, "modelStartToFirstAudioMs") ??
        latency(
          byEvent.get("model_response_started")?.timestamp,
          byEvent.get("first_model_audio_received")?.timestamp
        )
    },
    {
      key: "firstAudioToPlayback",
      valueMs:
        numberFromRecord(summaryDetails, "firstAudioToPlaybackStartMs") ??
        latency(
          byEvent.get("first_model_audio_received")?.timestamp,
          byEvent.get("playback_started")?.timestamp
        )
    },
    {
      key: "totalTurn",
      valueMs:
        numberFromRecord(summaryDetails, "totalTurnDurationMs") ??
        latency(
          byEvent.get("mic_first_frame_captured")?.timestamp,
          byEvent.get("playback_completed")?.timestamp
        )
    }
  ];

  const checkpoints = useMemo(() => {
    const firstTimestamp = turnEvents[0]?.timestamp;
    return turnEvents
      .filter(
        (event) =>
          event.event &&
          event.event in text.checkpointLabels
      )
      .map((event) => ({
        id: event.id,
        label: text.checkpointLabels[event.event as keyof typeof text.checkpointLabels],
        time: formatClock(event.timestamp),
        relative:
          firstTimestamp !== undefined
            ? `+${formatSeconds(event.timestamp - firstTimestamp)}`
            : null
      }));
  }, [text.checkpointLabels, turnEvents]);

  return (
    <aside className="panel live-latency-panel">
      <header className="live-latency-header">
        <div className="panel-title">{text.panelTitle}</div>
        <span className={`live-latency-stage live-latency-stage-${stage.tone}`}>
          {stage.label}
        </span>
      </header>

      <div className="live-latency-turn-id">
        {text.turnLabel}: {latestTurnId ? shortenTurnId(latestTurnId) : "-"}
      </div>

      <div className="live-latency-metrics">
        {metrics.map((metric) => (
          <div key={metric.key} className="live-latency-metric-row">
            <span>{text.metrics[metric.key]}</span>
            <strong>{formatDuration(metric.valueMs)}</strong>
          </div>
        ))}
      </div>

      <div className="live-latency-divider" />

      <div className="live-latency-timeline-title">{text.checkpointsTitle}</div>
      <div className="live-latency-timeline">
        {checkpoints.length === 0 ? (
          <div className="live-latency-empty">{text.noTurn}</div>
        ) : (
          checkpoints.map((checkpoint) => (
            <div key={checkpoint.id} className="live-latency-checkpoint">
              <span className="live-latency-checkpoint-label">{checkpoint.label}</span>
              <span className="live-latency-checkpoint-time">
                {checkpoint.time}
                {checkpoint.relative ? ` (${checkpoint.relative})` : ""}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="live-latency-missing-hint">{text.missingHint}</div>
    </aside>
  );
}

function numberFromRecord(
  input: Record<string, unknown> | undefined,
  key: string
): number | null {
  if (!input) {
    return null;
  }
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function latency(start?: number, end?: number): number | null {
  if (start === undefined || end === undefined) {
    return null;
  }
  return Math.max(0, end - start);
}

function formatDuration(valueMs: number | null): string {
  if (valueMs === null) {
    return "-";
  }
  if (valueMs < 1000) {
    return `${Math.round(valueMs)} ms`;
  }
  return `${(valueMs / 1000).toFixed(2)} s`;
}

function formatSeconds(valueMs: number): string {
  return `${(valueMs / 1000).toFixed(2)}s`;
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

function shortenTurnId(turnId: string): string {
  if (turnId.length <= 10) {
    return turnId;
  }
  return `${turnId.slice(0, 6)}...${turnId.slice(-4)}`;
}
