import { contextBridge } from "electron";
import { liveBridge } from "./bridges/liveBridge";
import { settingsBridge } from "./bridges/settingsBridge";
import { mediaBridge } from "./bridges/mediaBridge";
import { diagnosticsBridge } from "./bridges/diagnosticsBridge";
import type { WindowApi } from "../shared/types/ipc";

const api: WindowApi = {
  live: liveBridge,
  settings: settingsBridge,
  media: mediaBridge,
  diagnostics: diagnosticsBridge
};

contextBridge.exposeInMainWorld("appApi", api);
