import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./windows/mainWindow";
import { SettingsRepository } from "./settingsRepository";
import { SecureKeyStorage } from "./security/secureStorage";
import { DisplayMediaPermissions } from "./security/permissions";
import { LiveWorkerLauncher } from "./workers/liveWorkerLauncher";
import { registerSettingsIpc } from "./ipc/settings.ipc";
import { registerLiveIpc } from "./ipc/live.ipc";
import { registerDisplayMediaIpc } from "./ipc/displayMedia.ipc";
import { registerDiagnosticsIpc } from "./ipc/diagnostics.ipc";
import type { DiagnosticsEvent } from "../shared/types/diagnostics";
import type { WorkerEvent } from "../shared/types/live";

const diagnosticsLogger: Record<DiagnosticsEvent["level"], (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};

const recentDiagnostics: DiagnosticsEvent[] = [];

let mainWindow: BrowserWindow | null = null;
let workerLauncher: LiveWorkerLauncher | null = null;
let shuttingDown = false;

function pushDiagnostics(event: DiagnosticsEvent): void {
  const normalized = normalizeDiagnosticsEvent(event);
  recentDiagnostics.unshift(normalized);
  recentDiagnostics.splice(250);
  diagnosticsLogger[normalized.level](
    `[${normalized.category}] ${normalized.event ?? normalized.message}`,
    normalized.details ?? {}
  );
  mainWindow?.webContents.send("live:event", {
    type: "diagnostics",
    payload: normalized
  });
}

function forwardWorkerEvent(event: WorkerEvent): void {
  if (event.type === "diagnostics") {
    pushDiagnostics(event.payload);
    return;
  }

  mainWindow?.webContents.send("live:event", event);
}

async function shutdownApplication(): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  try {
    await Promise.race([
      workerLauncher?.disconnect() ?? Promise.resolve(),
      delay(350)
    ]);
  } finally {
    workerLauncher?.shutdown();
  }
}

async function closeMainWindow(): Promise<void> {
  await shutdownApplication();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  pushDiagnostics({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level: "info",
    category: "worker",
    message: "Application ready",
    details: {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: process.platform
    }
  });

  const repository = new SettingsRepository();
  const secureStorage = new SecureKeyStorage();
  const permissions = new DisplayMediaPermissions(pushDiagnostics);
  workerLauncher = new LiveWorkerLauncher(forwardWorkerEvent, pushDiagnostics);

  registerSettingsIpc(repository, secureStorage);
  registerLiveIpc(repository, secureStorage, workerLauncher);
  registerDisplayMediaIpc(permissions);
  registerDiagnosticsIpc(
    pushDiagnostics,
    () => recentDiagnostics,
    () => workerLauncher?.getEffectiveConfig() ?? null,
    () => repository.load()
  );

  mainWindow = createMainWindow();
  pushDiagnostics({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level: "info",
    category: "worker",
    message: "Main window created"
  });
  mainWindow.on("close", (event) => {
    if (shuttingDown) {
      return;
    }

    event.preventDefault();
    void closeMainWindow();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (process.platform === "win32") {
      app.exit(0);
    }
  });

  app.on("activate", () => {
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
  });
}

app.on("window-all-closed", () => {
  void shutdownApplication();
  if (process.platform !== "darwin") {
    app.exit(0);
  }
});

app.on("before-quit", () => {
  void shutdownApplication();
});

app.on("will-quit", () => {
  void shutdownApplication();
});

void bootstrap();

function normalizeDiagnosticsEvent(event: DiagnosticsEvent): DiagnosticsEvent {
  const timestamp = Number.isFinite(event.timestamp) ? event.timestamp : Date.now();
  const message = event.message?.trim() || "diagnostics_event";
  return {
    ...event,
    timestamp,
    event: event.event?.trim() || toEventName(message),
    message
  };
}

function toEventName(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
