import type { WindowApi } from "@shared/types/ipc";

declare global {
  interface Window {
    appApi: WindowApi;
  }
}

export {};
