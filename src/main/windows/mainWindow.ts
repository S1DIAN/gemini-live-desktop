import path from "node:path";
import { app, BrowserWindow } from "electron";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void window.loadURL(devUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(path.join(app.getAppPath(), "dist", "renderer", "index.html"));
  }

  return window;
}
