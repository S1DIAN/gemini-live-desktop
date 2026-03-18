import path from "node:path";
import { app, BrowserWindow } from "electron";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#101722",
    autoHideMenuBar: true,
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

  window.setMenuBarVisibility(false);

  return window;
}
