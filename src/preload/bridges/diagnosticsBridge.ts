import { ipcRenderer } from "electron";
import type { DiagnosticsBridgeApi } from "../../shared/types/ipc";

export const diagnosticsBridge: DiagnosticsBridgeApi = {
  exportLogs: () => ipcRenderer.invoke("diagnostics:export"),
  getEffectiveConfig: () => ipcRenderer.invoke("diagnostics:effective-config"),
  getRecentDiagnostics: () => ipcRenderer.invoke("diagnostics:recent"),
  appendClientEvent: (event) =>
    ipcRenderer.invoke("diagnostics:append-client", event)
};
