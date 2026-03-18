import { ipcRenderer } from "electron";
import type { MediaBridgeApi } from "../../shared/types/ipc";

export const mediaBridge: MediaBridgeApi = {
  listDisplaySources: () => ipcRenderer.invoke("media:list-display-sources"),
  armDisplayCapture: (sourceId) =>
    ipcRenderer.invoke("media:arm-display-capture", sourceId)
};
