import { ipcMain } from "electron";
import { armDisplayCaptureSchema } from "../../shared/schema/ipcSchema";
import type { DisplayMediaPermissions } from "../security/permissions";

export function registerDisplayMediaIpc(
  permissions: DisplayMediaPermissions
): void {
  ipcMain.handle("media:list-display-sources", () => permissions.listSources());
  ipcMain.handle("media:arm-display-capture", (_event, sourceId: string) => {
    const parsed = armDisplayCaptureSchema.parse({ sourceId });
    permissions.armCapture(parsed.sourceId);
  });
}
