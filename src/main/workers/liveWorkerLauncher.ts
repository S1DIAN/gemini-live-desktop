import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { app, MessageChannelMain, utilityProcess, type MessagePortMain, type UtilityProcess, type WebContents } from "electron";
import path from "node:path";
import type { DisconnectMode, EffectiveRuntimeConfig, MediaPortKind, VoiceTurnTelemetryEvent, WorkerCommand, WorkerConnectRequest, WorkerEvent, WorkerTextRequest } from "../../shared/types/live";
import type { DiagnosticsEvent } from "../../shared/types/diagnostics";
import { toErrorDetails } from "../../shared/utils/errorDetails";

const WORKER_CONNECT_WATCHDOG_MS = 45000;
const MAX_STDIO_PREVIEW_LENGTH = 4000;
const WORKER_BOOTSTRAP_FILENAME = "live-worker-bootstrap.cjs";
const WORKER_BOOTSTRAP_SOURCE = `"use strict";
const workerEntry = process.argv[2];
if (!workerEntry) {
  throw new Error("Missing live worker entry path");
}
require(workerEntry);
`;

export class LiveWorkerLauncher {
  private child: UtilityProcess | null = null;
  private workerReady = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;
  private queuedCommands: WorkerCommand[] = [];
  private queuedPorts: Array<{ kind: MediaPortKind; port: MessagePortMain }> = [];
  private pendingConnect:
    | ((value: { ok: boolean; reason?: string }) => void)
    | null = null;
  private pendingConnectTimeout: NodeJS.Timeout | null = null;
  private pendingConnectMeta:
    | {
        id: string;
        startedAt: number;
        requestSummary: Record<string, unknown>;
      }
    | null = null;
  private effectiveConfig: EffectiveRuntimeConfig | null = null;
  private workerStartedAt = 0;

  constructor(
    private readonly onWorkerEvent: (event: WorkerEvent) => void,
    private readonly emitDiagnostics: (event: DiagnosticsEvent) => void
  ) {}

  async connect(payload: WorkerConnectRequest): Promise<{ ok: boolean; reason?: string }> {
    this.ensureStarted();

    return new Promise((resolve) => {
      const connectId = crypto.randomUUID();
      const startedAt = Date.now();
      const requestSummary = summarizeConnectRequest(payload);
      this.resolvePendingConnect({
        ok: false,
        reason: "A previous connect attempt was replaced by a new one"
      });
      this.pendingConnect = resolve;
      this.pendingConnectMeta = {
        id: connectId,
        startedAt,
        requestSummary
      };
      this.emitDiagnostics({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "info",
        category: "worker",
        message: "Live worker connect started",
        details: {
          connectId,
          watchdogMs: WORKER_CONNECT_WATCHDOG_MS,
          request: requestSummary
        }
      });
      this.pendingConnectTimeout = setTimeout(() => {
        this.emitDiagnostics({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "error",
          category: "worker",
          message: "Live worker connect timed out",
          details: {
            connectId,
            watchdogMs: WORKER_CONNECT_WATCHDOG_MS,
            elapsedMs: Date.now() - startedAt,
            request: requestSummary
          }
        });
        this.resolvePendingConnect({
          ok: false,
          reason: "Live worker did not respond to connect"
        });
        this.shutdown();
      }, WORKER_CONNECT_WATCHDOG_MS);
      void this.postCommand({ type: "connect", payload });
    });
  }

  async disconnect(mode: DisconnectMode = "pause"): Promise<void> {
    if (!this.child) {
      return;
    }

    await this.postCommand({ type: "disconnect", payload: { mode } });
  }

  async sendText(payload: WorkerTextRequest): Promise<void> {
    this.ensureStarted();
    await this.postCommand({ type: "send-text", payload });
  }

  async sendVoiceTurnEvent(payload: VoiceTurnTelemetryEvent): Promise<void> {
    this.ensureStarted();
    await this.postCommand({ type: "voice-turn-event", payload });
  }

  async attachMediaPorts(target: WebContents): Promise<void> {
    this.ensureStarted();
    this.attachPort(target, "audio-input");
    this.attachPort(target, "visual-input");
  }

  getEffectiveConfig(): EffectiveRuntimeConfig | null {
    return this.effectiveConfig;
  }

  shutdown(): void {
    const child = this.child;
    this.child = null;
    this.workerReady = false;
    this.readyPromise = null;
    this.readyResolver = null;
    this.queuedCommands = [];
    this.queuedPorts = [];
    this.effectiveConfig = null;
    this.pendingConnectMeta = null;
    this.resolvePendingConnect({ ok: false, reason: "Application shutdown" });

    if (!child) {
      return;
    }

    child.removeAllListeners();
    const pid = child.pid;
    child.kill();
    if (!pid) {
      return;
    }

    if (process.platform === "win32") {
      this.forceKillProcessTree(pid);
      return;
    }

    try {
      process.kill(pid);
    } catch {
      // Ignore already-exited worker processes.
    }
  }

  private attachPort(target: WebContents, kind: MediaPortKind): void {
    const { port1, port2 } = new MessageChannelMain();
    port1.start();
    if (this.workerReady) {
      this.sendPort(kind, port1);
    } else {
      this.queuedPorts.push({ kind, port: port1 });
    }
    target.postMessage("live:port", { kind }, [port2]);
  }

  private ensureStarted(): void {
    if (this.child) {
      return;
    }

    const workerPath = path.join(app.getAppPath(), "dist", "worker", "liveWorker.js");
    const bootstrapPath = this.ensureWorkerBootstrap();
    const workerCwd = this.resolveWorkerCwd();
    this.workerStartedAt = Date.now();
    this.workerReady = false;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolver = resolve;
    });
    this.child = utilityProcess.fork(bootstrapPath, [workerPath], {
      stdio: "pipe",
      serviceName: "Gemini Live Worker",
      cwd: workerCwd
    });
    this.emitDiagnostics({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level: "info",
      category: "worker",
      message: "Launching live worker process",
      details: {
        workerPath,
        bootstrapPath,
        cwd: workerCwd,
        pid: this.child.pid ?? null
      }
    });
    this.attachWorkerStreamLogging("stdout");
    this.attachWorkerStreamLogging("stderr");

    this.child.on("message", (message) => {
      const event = message as WorkerEvent;
      if (event.type === "worker-ready") {
        this.workerReady = true;
        this.readyResolver?.();
        this.readyResolver = null;
        this.flushQueuedCommands();
        this.flushQueuedPorts();
        this.emitDiagnostics({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: "info",
          category: "worker",
          message: "Live worker handshake completed",
          details: {
            pid: this.child?.pid ?? null,
            readyInMs: Date.now() - this.workerStartedAt
          }
        });
        return;
      }

      if (event.type === "connect-result") {
        this.emitDiagnostics({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          level: event.payload.ok ? "info" : "error",
          category: "worker",
          message: event.payload.ok
            ? "Live worker connect finished"
            : "Live worker connect failed",
          details: {
            connectId: this.pendingConnectMeta?.id ?? null,
            elapsedMs: this.pendingConnectMeta
              ? Date.now() - this.pendingConnectMeta.startedAt
              : null,
            reason: event.payload.reason,
            request: this.pendingConnectMeta?.requestSummary ?? null
          }
        });
        this.resolvePendingConnect(event.payload);
      }

      if (event.type === "effective-config") {
        this.effectiveConfig = event.payload;
      }

      this.onWorkerEvent(event);
    });

    this.child.on("error", (error) => {
      this.emitDiagnostics({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: "error",
        category: "worker",
        message: "Live worker crashed",
        details: toErrorDetails(error)
      });
      this.resolvePendingConnect({
        ok: false,
        reason: "Live worker crashed before connect completed"
      });
      this.workerReady = false;
      this.readyPromise = null;
      this.readyResolver = null;
      this.queuedCommands = [];
      this.queuedPorts = [];
      this.child = null;
    });

    this.child.on("exit", (code) => {
      this.emitDiagnostics({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: code === 0 ? "info" : "error",
        category: "worker",
        message: "Live worker exited",
        details: {
          code,
          connectId: this.pendingConnectMeta?.id ?? null
        }
      });
      this.resolvePendingConnect({
        ok: false,
        reason: code === 0
          ? "Live worker exited before connect completed"
          : "Live worker exited unexpectedly"
      });
      this.workerReady = false;
      this.readyPromise = null;
      this.readyResolver = null;
      this.queuedCommands = [];
      this.queuedPorts = [];
      this.child = null;
    });
  }

  private async postCommand(command: WorkerCommand): Promise<void> {
    if (!this.workerReady) {
      this.queuedCommands.push(command);
      await this.readyPromise;
      return;
    }

    this.child?.postMessage(command);
  }

  private resolvePendingConnect(result: { ok: boolean; reason?: string }): void {
    if (this.pendingConnectTimeout) {
      clearTimeout(this.pendingConnectTimeout);
      this.pendingConnectTimeout = null;
    }

    if (!this.pendingConnect) {
      return;
    }

    const pendingConnect = this.pendingConnect;
    this.pendingConnect = null;
    this.pendingConnectMeta = null;
    pendingConnect(result);
  }

  private attachWorkerStreamLogging(streamName: "stdout" | "stderr"): void {
    const stream = this.child?.[streamName];
    if (!stream) {
      return;
    }

    stream.on("data", (chunk: Buffer | string) => {
      const text = String(chunk).trim();
      if (!text) {
        return;
      }

      this.emitDiagnostics({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: streamName === "stderr" ? "warn" : "debug",
        category: "worker",
        message: `Live worker ${streamName}`,
        details: {
          preview: text.slice(0, MAX_STDIO_PREVIEW_LENGTH)
        }
      });
    });
  }

  private ensureWorkerBootstrap(): string {
    const bootstrapPath = path.join(
      app.getPath("userData"),
      WORKER_BOOTSTRAP_FILENAME
    );

    if (!existsSync(bootstrapPath)) {
      writeFileSync(bootstrapPath, WORKER_BOOTSTRAP_SOURCE, "utf8");
      return bootstrapPath;
    }

    const current = readFileSync(bootstrapPath, "utf8");
    if (current !== WORKER_BOOTSTRAP_SOURCE) {
      writeFileSync(bootstrapPath, WORKER_BOOTSTRAP_SOURCE, "utf8");
    }

    return bootstrapPath;
  }

  private resolveWorkerCwd(): string {
    const appPath = app.getAppPath();
    return app.isPackaged ? path.dirname(appPath) : appPath;
  }

  private forceKillProcessTree(pid: number): void {
    try {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      killer.unref();
    } catch {
      try {
        process.kill(pid);
      } catch {
        // Ignore already-exited worker processes.
      }
    }
  }

  private flushQueuedCommands(): void {
    if (!this.workerReady || !this.child) {
      return;
    }

    const queuedCommands = this.queuedCommands;
    this.queuedCommands = [];
    for (const command of queuedCommands) {
      this.child.postMessage(command);
    }
  }

  private flushQueuedPorts(): void {
    if (!this.workerReady) {
      return;
    }

    const queuedPorts = this.queuedPorts;
    this.queuedPorts = [];
    for (const entry of queuedPorts) {
      this.sendPort(entry.kind, entry.port);
    }
  }

  private sendPort(kind: MediaPortKind, port: MessagePortMain): void {
    this.child?.postMessage(
      { type: "attach-media-port", payload: { kind } satisfies { kind: MediaPortKind } },
      [port]
    );
  }
}

function summarizeConnectRequest(
  payload: WorkerConnectRequest
): Record<string, unknown> {
  return {
    useMock: payload.useMock ?? false,
    model: payload.settings.model,
    requestedApiVersion: payload.settings.apiVersion,
    proactiveMode: payload.settings.proactiveMode,
    voiceName: payload.settings.voiceName,
    allowInterruption: payload.settings.allowInterruption,
    speechLanguageCode: payload.settings.speechLanguageCode,
    inputTranscriptionEnabled: payload.settings.inputTranscriptionEnabled,
    outputTranscriptionEnabled: payload.settings.outputTranscriptionEnabled,
    mediaResolution: payload.settings.mediaResolution,
    manualVadMode: payload.settings.manualVadMode,
    customVadEnabled: payload.settings.vadEnabled
  };
}
