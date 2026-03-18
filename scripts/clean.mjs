import { rmSync } from "node:fs";
import { resolve } from "node:path";

for (const target of ["dist", "release", "artifacts"]) {
  try {
    rmSync(resolve(process.cwd(), target), { recursive: true, force: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      console.warn(`Skipping cleanup for locked path: ${target}`);
      continue;
    }
    throw error;
  }
}
