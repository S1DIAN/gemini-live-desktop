import { GoogleGenAI, Modality } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";

const MODEL = "gemini-2.5-flash-preview-tts";
const MIN_INTERVAL_MS = 6200;
const MAX_RETRY_ATTEMPTS = 4;
const OUTPUT_ROOT = path.resolve(process.cwd(), "assets", "voice-previews");
const VOICES_FILE = path.resolve(
  process.cwd(),
  "src",
  "shared",
  "constants",
  "liveSpeech.ts"
);
const PREVIEW_TEXT = {
  en: "Hello. This is a voice preview sample in English.",
  ru: "Привет. Это демонстрационный пример голоса на русском языке."
};

const force = process.argv.includes("--force");
const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
const voices = await readVoiceNames();
const tasks = [];

for (const language of Object.keys(PREVIEW_TEXT)) {
  for (const voiceName of voices) {
    tasks.push({ language, voiceName });
  }
}

let succeeded = 0;
let skipped = 0;
let failed = 0;
let nextAllowedAt = 0;

for (const [index, task] of tasks.entries()) {
  const outputPath = resolveOutputPath(task.language, task.voiceName);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (!force && (await exists(outputPath))) {
    skipped += 1;
    console.log(
      `[${index + 1}/${tasks.length}] skip ${task.language}/${task.voiceName}`
    );
    continue;
  }

  const waitMs = Math.max(0, nextAllowedAt - Date.now());
  if (waitMs > 0) {
    await delay(waitMs);
  }

  try {
    const wav = await synthesizePreview(task.voiceName, task.language);
    await fs.writeFile(outputPath, wav);
    nextAllowedAt = Date.now() + MIN_INTERVAL_MS;
    succeeded += 1;
    console.log(
      `[${index + 1}/${tasks.length}] ok   ${task.language}/${task.voiceName}`
    );
  } catch (error) {
    failed += 1;
    console.error(
      `[${index + 1}/${tasks.length}] fail ${task.language}/${task.voiceName}: ${asErrorMessage(
        error
      )}`
    );
  }
}

console.log(
  `Done. succeeded=${succeeded} skipped=${skipped} failed=${failed} output=${OUTPUT_ROOT}`
);

if (failed > 0) {
  process.exit(1);
}

async function synthesizePreview(voiceName, language) {
  let attempt = 0;
  while (true) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ parts: [{ text: PREVIEW_TEXT[language] }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        }
      });
      const inlineData =
        response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)
          ?.inlineData ?? null;
      if (!inlineData?.data) {
        throw new Error("Gemini API returned no audio data");
      }
      if (isPcmMime(inlineData.mimeType ?? "")) {
        const sampleRate = parsePcmSampleRate(inlineData.mimeType) ?? 24000;
        return pcm16ToWavBytes(base64ToBytes(inlineData.data), sampleRate);
      }
      if (/audio\/wav/i.test(inlineData.mimeType ?? "")) {
        return base64ToBytes(inlineData.data);
      }
      throw new Error(`Unsupported preview mime type: ${inlineData.mimeType ?? "unknown"}`);
    } catch (error) {
      attempt += 1;
      const retryDelayMs = extractRetryDelayMs(error);
      if (retryDelayMs === null || attempt >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }
      await delay(retryDelayMs);
    }
  }
}

async function readVoiceNames() {
  const source = await fs.readFile(VOICES_FILE, "utf8");
  const start = source.indexOf("export const LIVE_PREBUILT_VOICE_NAMES = [");
  if (start < 0) {
    throw new Error("Cannot locate LIVE_PREBUILT_VOICE_NAMES");
  }
  const end = source.indexOf("] as const", start);
  if (end < 0) {
    throw new Error("Cannot locate end of LIVE_PREBUILT_VOICE_NAMES");
  }
  const block = source.slice(start, end);
  const voices = [];
  for (const match of block.matchAll(/"([^"]+)"/g)) {
    if (match[1]) {
      voices.push(match[1]);
    }
  }
  if (voices.length === 0) {
    throw new Error("No voices found in LIVE_PREBUILT_VOICE_NAMES");
  }
  return voices;
}

function resolveOutputPath(language, voiceName) {
  return path.join(OUTPUT_ROOT, language, `${sanitizeVoiceName(voiceName)}.wav`);
}

function sanitizeVoiceName(voiceName) {
  return voiceName.replace(/[^a-z0-9_-]/gi, "_");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parsePcmSampleRate(mimeType) {
  const match = mimeType.match(/(?:^|[;,\s])rate=(\d+)/i);
  if (!match?.[1]) {
    return null;
  }
  const rate = Number.parseInt(match[1], 10);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function isPcmMime(mimeType) {
  return /^audio\/pcm/i.test(mimeType) || /^audio\/l16/i.test(mimeType);
}

function pcm16ToWavBytes(pcmBytes, sampleRate) {
  const wavBytes = new Uint8Array(44 + pcmBytes.byteLength);
  const view = new DataView(wavBytes.buffer);
  const byteRate = sampleRate * 2;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

function writeAscii(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function base64ToBytes(base64) {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function extractRetryDelayMs(error) {
  const payloads = [];
  if (error && typeof error === "object") {
    payloads.push(error);
    if (error.error) {
      payloads.push(error.error);
    }
    if (typeof error.message === "string") {
      const parsed = tryParseJson(error.message);
      if (parsed) {
        payloads.push(parsed);
      }
    }
  } else if (typeof error === "string") {
    const parsed = tryParseJson(error);
    if (parsed) {
      payloads.push(parsed);
    }
  }
  for (const payload of payloads) {
    const byDetails = extractRetryDelayFromDetails(payload);
    if (byDetails !== null) {
      return byDetails;
    }
    const byMessage = extractRetryDelayFromMessage(payload);
    if (byMessage !== null) {
      return byMessage;
    }
  }
  return null;
}

function extractRetryDelayFromDetails(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.details)) {
    return null;
  }
  for (const detail of payload.details) {
    const parsed = parseDurationToMs(detail?.retryDelay);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function extractRetryDelayFromMessage(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.message !== "string") {
    return null;
  }
  const match = payload.message.match(/retry in\s+([\d.]+)s/i);
  if (!match?.[1]) {
    return null;
  }
  const seconds = Number.parseFloat(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.ceil(seconds * 1000);
}

function parseDurationToMs(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/^([\d.]+)s$/i);
  if (!match?.[1]) {
    return null;
  }
  const seconds = Number.parseFloat(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.ceil(seconds * 1000);
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(value.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
