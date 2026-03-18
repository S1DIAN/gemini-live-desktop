# Gemini Live Desktop MVP

Windows-only Electron desktop client for Gemini Live. The app keeps the API key out of the renderer, runs the live session in an isolated worker process, and supports voice, camera, and screen interaction with realtime diagnostics and proactive commentary.

## Highlights

- Single-user local desktop app for Windows.
- Encrypted Gemini API key storage in the main process.
- Microphone, camera, and screen capture with binary transport to the worker.
- Live transcription, turn latency telemetry, and diagnostics export.
- `Pause` preserves resumable session state; `Disconnect` clears it.
- English and Russian UI with runtime switching.
- Pure and assisted proactive modes with capability normalization.
- Worker lifecycle handling, reconnect support, and session resumption.

## Stack

- Electron 41
- React 19
- TypeScript 5.9
- Vite 8
- `@google/genai` 1.45
- Zustand
- Zod
- electron-builder

## Repository Layout

```text
src/
  main/       Electron main process, storage, IPC, permissions, worker launch
  preload/    Narrow bridges exposed to the renderer
  renderer/   React UI, media capture, playback, state, and i18n
  worker/     Gemini Live session, normalization, reconnect, and bootstrap
  shared/     IPC contracts, schemas, and shared types
test/         Vitest tests
scripts/      Dev/build helpers
docs/         Architecture and implementation notes
```

Detailed boundaries and invariants live in [docs/architecture.md](C:/Users/darkg/Desktop/New/docs/architecture.md).

## Requirements

- Windows
- Node.js 24+
- npm 11+

## Setup

```powershell
npm install
```

## Development

```powershell
npm run dev
```

## Build

```powershell
npm run build
```

## Packaging

```powershell
npm run dist:win
```

## Workflow

1. Start the app.
2. Open Settings and save a Gemini API key.
3. Configure the model, voice, devices, visual settings, behavior, and diagnostics options.
4. Return to the Call page.
5. Switch UI language from the sidebar if needed; the choice applies immediately to the interface and to the next live connect.
6. Connect a live session.
7. Enable microphone, camera, and screen capture as needed.
8. Use the realtime controls and renderer-side tuning while connected.
9. Use `Pause` to close transport while keeping resumable session state.
10. Use `Disconnect` for a full reset and a fresh next connect.
11. Change connect-time options by disconnecting first, then reconnecting with the new settings.
12. Watch transcripts, diagnostics, and proactive decisions in real time.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

## Security And Runtime Constraints

- Saved API keys never return to the renderer as plaintext.
- The renderer never gets direct Node or Electron access.
- Connect requests are blocked until capability normalization succeeds.
- Connect and media controls must always resolve to a success or failure state.
- The Call page shows inline feedback for connect and media actions.
- Connect-time session options are locked while a live session is active or a paused continuation is retained.
- Active local media streams survive route navigation and stop only on explicit toggles or terminal session states.
- Screen and camera are sent as periodic JPEG frames with `latest-frame-wins`.
- Streaming media uses binary payloads through message channels, not base64 transport between renderer and worker.
- The main process waits for an explicit worker-ready handshake before delivering connect commands.
- Diagnostics surface worker launch, handshake, connect timing, normalized effective config, and serialized error details.
- Voice diagnostics stay structured and must not include API secrets or raw audio payloads.
- Malformed media payloads are dropped with diagnostics warnings and must not crash the worker process.
- Packaged builds launch the worker through a filesystem bootstrap script that loads the bundled worker entry.
- On Windows, closing the last app window first disconnects the live session and then tears down the worker process tree if needed.

## Notes

- The current default Gemini model is `gemini-2.5-flash-native-audio-preview-12-2025`.
- API version is auto-selected: `v1alpha` when Proactive Mode is not `off` or Affective Dialog is enabled; otherwise `v1beta`.
- `Pause` keeps session resumption state; `Disconnect` clears it so the next connect starts a fresh live session.
- Runtime capability normalization remains the final authority for effective live config.
- Renderer language preference is stored locally in browser storage and applied immediately to all UI pages.
- Renderer locale (`en`/`ru`) is sent as a connect-time speech-language override (`speechConfig.languageCode`) on each live connect, without rewriting the persisted settings file.
- For `gemini-2.5-flash-native-audio-preview-12-2025`, explicit `speechConfig.languageCode=ru` is currently disabled by normalization due backend `Unsupported language code` disconnects.
- Settings voice selection is a prebuilt voice list of 30 Gemini TTS voice names.
- Gemini API live connect uses `sessionResumption.handle` only; the Vertex-specific `transparent` flag is not sent.
- Gemini API live transcription config is sent as an empty `AudioTranscriptionConfig`; `languageCodes` is not sent because the Gemini Developer API rejects it.
- Gemini API live connect keeps automatic activity detection enabled; client-side manual VAD signaling (`activityStart`/`activityEnd`) is not wired yet.
- Screen and camera frames are sent via `sendRealtimeInput.video`.
- Assisted proactive screen hints are emitted only after the current screen frame send completes.
- Worker sends `proactive_hidden_hint` through `sendRealtimeInput.text` so proactive trigger text is aligned with live media timing.
- When microphone streaming is paused, the worker sends `sendRealtimeInput({ audioStreamEnd: true })` to flush cached audio while automatic activity detection is active.
- If renderer media message ports detach during runtime, the renderer requests fresh media ports and retries audio or visual frame delivery once before failing the active media control.
- Microphone capture handles unexpected track-end events explicitly, resets the toggle, emits diagnostics, and shows an inline transport failure message.
- If a previously saved microphone device ID is no longer available, microphone capture falls back to the default input device automatically.
- The Diagnostics page shows the effective config even for failed connect attempts, plus worker lifecycle and timeout details.
- Diagnostics files are created only when `Export Logs` is used.
- Voice turn telemetry logs key latency checkpoints and emits per-turn `turn_latency_summary` with mode context.
- Diagnostics export includes renderer-originated proactive diagnostics in the same merged main-process timeline.
- Default assisted proactive tuning is faster: `changeThreshold=0.12` and `maxAutonomousCommentFrequencyMs=6000`.
- Legacy settings values equal to the previous defaults are auto-migrated on load.
- Runtime proactive tuning on the Call page is mode-aware: `pure` uses a lower effective change-threshold and shorter effective minimum interval than `assisted`.
