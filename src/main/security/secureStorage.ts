import { promises as fs } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

export class SecureKeyStorage {
  private readonly filePath = path.join(app.getPath("userData"), "gemini-api-key.bin");

  async hasKey(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMaskedState(): Promise<{ hasKey: boolean; maskedLabel: string }> {
    const key = await this.getPlaintext();
    if (!key) {
      return { hasKey: false, maskedLabel: "" };
    }

    const masked =
      key.length <= 8
        ? `${key.slice(0, 2)}***`
        : `${key.slice(0, 4)}...${key.slice(-4)}`;

    return { hasKey: true, maskedLabel: masked };
  }

  async savePlaintext(apiKey: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const encrypted = safeStorage.encryptString(apiKey.trim());
    await fs.writeFile(this.filePath, encrypted);
  }

  async clear(): Promise<void> {
    await fs.rm(this.filePath, { force: true });
  }

  async getPlaintext(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.filePath);
      return safeStorage.decryptString(raw);
    } catch {
      return null;
    }
  }
}
