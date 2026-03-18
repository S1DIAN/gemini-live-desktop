import { ipcMain, dialog } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DiagnosticsEvent } from "../../shared/types/diagnostics";
import type { EffectiveRuntimeConfig } from "../../shared/types/live";
import type { AppSettings } from "../../shared/types/settings";
import { diagnosticsEventSchema } from "../../shared/schema/liveEventSchema";

export function registerDiagnosticsIpc(
  pushDiagnostics: (event: DiagnosticsEvent) => void,
  getRecentDiagnostics: () => DiagnosticsEvent[],
  getEffectiveConfig: () => EffectiveRuntimeConfig | null,
  loadSettings: () => Promise<AppSettings>
): void {
  ipcMain.handle("diagnostics:recent", () => getRecentDiagnostics());
  ipcMain.handle("diagnostics:effective-config", () => getEffectiveConfig());
  ipcMain.handle("diagnostics:append-client", (_event, payload) => {
    const event = diagnosticsEventSchema.parse(payload);
    pushDiagnostics(event);
  });
  ipcMain.handle("diagnostics:export", async () => {
    const settings = await loadSettings();
    const exportHint = settings.diagnostics.exportPathHint.trim();
    const defaultPath = exportHint
      ? path.extname(exportHint)
        ? exportHint
        : path.join(exportHint, "gemini-live-desktop.diagnostics.json")
      : "gemini-live-desktop.diagnostics.json";

    const target = await dialog.showSaveDialog({
      title: "Export diagnostics log",
      defaultPath
    });

    if (target.canceled || !target.filePath) {
      return null;
    }

    const events = getRecentDiagnostics()
      .slice()
      .reverse()
      .map((event) => ({
        ...event,
        timestampIso: new Date(event.timestamp).toISOString()
      }));
    const payload = {
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      events
    };

    await fs.writeFile(target.filePath, JSON.stringify(payload, null, 2), "utf8");
    return target.filePath;
  });
}
