import { ipcMain } from "electron";
import { saveApiKeyPayloadSchema, saveSettingsPayloadSchema } from "../../shared/schema/ipcSchema";
import type { SettingsRepository } from "../settingsRepository";
import type { SecureKeyStorage } from "../security/secureStorage";

export function registerSettingsIpc(
  repository: SettingsRepository,
  secureStorage: SecureKeyStorage
): void {
  ipcMain.handle("settings:load", () => repository.load());
  ipcMain.handle("settings:save", (_event, payload) =>
    repository.save(saveSettingsPayloadSchema.parse(payload))
  );
  ipcMain.handle("settings:get-api-key-state", () => secureStorage.getMaskedState());
  ipcMain.handle("settings:save-api-key", async (_event, payload) => {
    const parsed = saveApiKeyPayloadSchema.parse(payload);
    await secureStorage.savePlaintext(parsed.apiKey);
    return secureStorage.getMaskedState();
  });
  ipcMain.handle("settings:clear-api-key", async () => {
    await secureStorage.clear();
    return secureStorage.getMaskedState();
  });
}
