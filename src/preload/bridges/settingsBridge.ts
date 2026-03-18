import { ipcRenderer } from "electron";
import type { SettingsBridgeApi } from "../../shared/types/ipc";

export const settingsBridge: SettingsBridgeApi = {
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getApiKeyState: () => ipcRenderer.invoke("settings:get-api-key-state"),
  saveApiKey: (payload) => ipcRenderer.invoke("settings:save-api-key", payload),
  clearApiKey: () => ipcRenderer.invoke("settings:clear-api-key")
};
