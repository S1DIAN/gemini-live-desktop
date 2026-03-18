import { describe, expect, it, vi } from "vitest";
import { LiveSessionManager } from "../../src/worker/live/liveSessionManager";
import type { WorkerEvent, WorkerConnectRequest, EffectiveRuntimeConfig } from "../../src/shared/types/live";

describe("LiveSessionManager turn diagnostics", () => {
  it("emits local commit and server ack diagnostics with mode context", () => {
    const events: WorkerEvent[] = [];
    const manager = new LiveSessionManager({
      emit: (event) => {
        events.push(event);
      }
    });

    const effectiveConfig: EffectiveRuntimeConfig = {
      snapshot: {
        model: "gemini-test",
        apiVersion: "v1alpha",
        voiceName: "Aoede",
        proactiveMode: "pure",
        thinkingBudget: 0,
        mediaResolution: "medium",
        proactiveAudioEnabled: true,
        affectiveDialogEnabled: false,
        contextWindowCompressionEnabled: true,
        sessionResumptionEnabled: true,
        customActivityDetectionEnabled: true,
        vadSensitivity: 0.5,
        silenceDurationMs: 900,
        prefixPaddingMs: 250,
        inputTranscriptionEnabled: true,
        outputTranscriptionEnabled: true,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        verboseDiagnosticsEnabled: true
      },
      diagnostics: []
    };

    const connectRequest: WorkerConnectRequest = {
      apiKey: "test-key",
      settings: {
        model: "gemini-test",
        apiVersion: "v1alpha",
        voiceName: "Aoede",
        proactiveMode: "pure",
        thinkingBudget: 0,
        mediaResolution: "medium",
        enableAffectiveDialog: false,
        inputTranscriptionEnabled: true,
        outputTranscriptionEnabled: true,
        systemPrompt: "",
        proactiveCommentaryPolicy: "",
        commentLengthPreset: "short",
        maxAutonomousCommentFrequencyMs: 1000,
        vadEnabled: true,
        vadSensitivity: 0.5,
        silenceDurationMs: 900,
        prefixPaddingMs: 250,
        manualVadMode: false,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        enableVerboseLogging: true
      }
    };

    (manager as unknown as {
      effectiveConfig: EffectiveRuntimeConfig;
      connectRequest: WorkerConnectRequest;
      sessionId: string;
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).effectiveConfig = effectiveConfig;
    (manager as unknown as {
      effectiveConfig: EffectiveRuntimeConfig;
      connectRequest: WorkerConnectRequest;
      sessionId: string;
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).connectRequest = connectRequest;
    (manager as unknown as {
      effectiveConfig: EffectiveRuntimeConfig;
      connectRequest: WorkerConnectRequest;
      sessionId: string;
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).sessionId = "session-1";

    manager.handleVoiceTurnEvent({
      event: "user_turn_input_completed",
      turnId: "turn-1",
      timestamp: 1000,
      silenceDurationMs: 900,
      speechDurationMs: 700,
      frameIndex: 12
    });

    (manager as unknown as {
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).liveCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          role: "model",
          parts: [{ text: "Hello" }]
        },
        generationComplete: true,
        turnComplete: true
      }
    });

    const diagnostics = events.filter(
      (event): event is Extract<WorkerEvent, { type: "diagnostics" }> =>
        event.type === "diagnostics"
    );

    const clientCommit = diagnostics.find(
      (event) => event.payload.event === "client_turn_commit_sent"
    );
    expect(clientCommit?.payload.details).toMatchObject({
      turnId: "turn-1",
      commitMode: "implicit_auto_activity_detection",
      explicitCommitSent: false,
      proactiveMode: "pure",
      proactiveAudioEnabled: true,
      apiVersion: "v1alpha",
      customActivityDetectionEnabled: true
    });

    const serverAck = diagnostics.find(
      (event) => event.payload.event === "server_turn_ack_received"
    );
    expect(serverAck?.payload.details).toMatchObject({
      turnId: "turn-1",
      sourceEventName: "server_content_model_signal",
      proactiveMode: "pure",
      proactiveAudioEnabled: true
    });

    const summary = diagnostics.find(
      (event) => event.payload.event === "turn_latency_summary"
    );
    expect(summary?.payload.details).toMatchObject({
      turnId: "turn-1",
      clientTurnCommitToServerAckMs: expect.any(Number),
      lastAudioSentToServerTurnDetectedMs: expect.any(Number),
      proactiveMode: "pure",
      proactiveAudioEnabled: true
    });
  });

  it("sends audioStreamEnd when microphone stream is paused", () => {
    const events: WorkerEvent[] = [];
    const manager = new LiveSessionManager({
      emit: (event) => {
        events.push(event);
      }
    });

    const signalAudioStreamEnd = vi.fn();
    (manager as unknown as { adapter: { signalAudioStreamEnd: () => void } }).adapter = {
      signalAudioStreamEnd
    };

    manager.handleVoiceTurnEvent({
      event: "mic_stream_paused",
      timestamp: 1234,
      reason: "microphone_stopped"
    });

    expect(signalAudioStreamEnd).toHaveBeenCalledTimes(1);
    const diagnostic = events.find(
      (event) =>
        event.type === "diagnostics" &&
        event.payload.event === "audio_stream_end_sent"
    );
    expect(diagnostic).toBeTruthy();
  });

  it("classifies autonomous model starts and emits proactivity latency", () => {
    const events: WorkerEvent[] = [];
    const manager = new LiveSessionManager({
      emit: (event) => {
        events.push(event);
      }
    });

    (manager as unknown as {
      effectiveConfig: EffectiveRuntimeConfig;
      sessionId: string;
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).effectiveConfig = {
      snapshot: {
        model: "gemini-test",
        apiVersion: "v1alpha",
        voiceName: "Aoede",
        proactiveMode: "assisted",
        thinkingBudget: 0,
        mediaResolution: "medium",
        proactiveAudioEnabled: true,
        affectiveDialogEnabled: false,
        contextWindowCompressionEnabled: true,
        sessionResumptionEnabled: true,
        customActivityDetectionEnabled: true,
        vadSensitivity: 0.5,
        silenceDurationMs: 900,
        prefixPaddingMs: 250,
        inputTranscriptionEnabled: true,
        outputTranscriptionEnabled: true,
        allowCommentaryDuringSilenceOnly: true,
        allowCommentaryWhileUserIdleOnly: true,
        verboseDiagnosticsEnabled: true
      },
      diagnostics: []
    };
    (manager as unknown as { sessionId: string }).sessionId = "session-2";

    manager.sendText({
      text: "hint",
      hidden: true,
      source: "proactive_hidden_hint"
    });

    (manager as unknown as {
      liveCallbacks: { onmessage: (message: unknown) => void };
    }).liveCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          role: "model",
          parts: [{ text: "Autonomous response" }]
        },
        generationComplete: true,
        turnComplete: true
      }
    });

    const diagnostics = events.filter(
      (event): event is Extract<WorkerEvent, { type: "diagnostics" }> =>
        event.type === "diagnostics"
    );

    const modelStart = diagnostics.find(
      (event) => event.payload.event === "model_response_started"
    );
    expect(modelStart?.payload.details).toMatchObject({
      startType: "autonomous_proactive",
      sessionId: "session-2"
    });

    const startTypeCount = diagnostics.find(
      (event) => event.payload.event === "response_start_type_count"
    );
    expect(startTypeCount?.payload.details).toMatchObject({
      startType: "autonomous_proactive",
      count: 1
    });

    const autonomousCount = diagnostics.find(
      (event) => event.payload.event === "proactivity_autonomous_start_count"
    );
    expect(autonomousCount?.payload.details).toMatchObject({
      count: 1
    });

    const triggerLatency = diagnostics.find(
      (event) => event.payload.event === "proactivity_trigger_to_model_start_ms"
    );
    expect(triggerLatency?.payload.details).toMatchObject({
      latencyMs: expect.any(Number)
    });
  });
});
