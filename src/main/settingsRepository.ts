import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  normalizeSettingsRecord,
  settingsSchema
} from "../shared/schema/settingsSchema";
import { applyAutoApiVersion, type AppSettings } from "../shared/types/settings";

export class SettingsRepository {
  private readonly filePath = path.join(app.getPath("userData"), "settings.json");

  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return normalizeSettingsRecord(JSON.parse(raw));
    } catch {
      return normalizeSettingsRecord(undefined);
    }
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const parsed = applyAutoApiVersion(settingsSchema.parse(settings));
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(parsed, null, 2), "utf8");
    return parsed;
  }
}
