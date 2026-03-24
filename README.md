# Gemini Live Desktop MVP

> ⚠️ This is an unofficial desktop client for Google Gemini Live.
> This project is not affiliated with, endorsed by, or sponsored by Google.

Windows-only Electron desktop client for Gemini Live with secure key handling, realtime media controls (voice/camera/screen), diagnostics export, and proactive commentary modes.

## Highlights

- Single-user local desktop app for Windows.
- Encrypted Gemini API key storage in the main process.
- Microphone, camera, and screen capture with binary worker transport.
- Turn latency telemetry, diagnostics export, and turn-final model transcript rendering.
- Turn-final model transcript rendering with API-native thought metadata (`thought`) for collapsible "thinking" UI.
- Chat-style transcript with compact dock-anchored camera/screen previews.
- Dock-level quick AI settings panel (gear) for model, voice, assistant mode and thinking controls.
- Sidebar language switcher (`English`/`Russian`) remains pinned at the bottom of the left column.
- `Pause` preserves resumable session state; `Disconnect` resets session state and clears renderer chat history.
- English and Russian UI with runtime switching.
- Pure and assisted proactive modes with capability normalization.
- Thinking configuration with explicit `off` / `auto` / `custom` modes, budget range guidance, thought-summary toggle and thinking-level selection.
- Worker lifecycle handling, reconnect support, and session resumption.
- Settings edits are autosaved shortly after changes; no manual "Save Settings" action is required.
- Optional live timing side panel on the Call page, driven by diagnostics checkpoint events for quick latency breakdowns plus a network ping estimate from periodic TCP probe to Gemini API endpoint (`generativelanguage.googleapis.com:443`).

## Tech Stack

- Electron 41
- React 19
- TypeScript 5.9
- Vite 8
- `@google/genai` 1.45
- Zustand
- Zod
- electron-builder

## Project Structure

```text
src/
  main/       Electron main process, storage, IPC, permissions, worker launch
  preload/    Narrow bridges exposed to the renderer
  renderer/   React UI, media capture/playback, state, i18n
  worker/     Gemini Live session, normalization, reconnect, bootstrap
  shared/     IPC contracts, schemas, shared types
test/         Vitest tests
scripts/      Dev/build helpers
docs/         Architecture and implementation notes
```

Architecture boundaries and invariants: [docs/architecture.md](C:/Users/darkg/Desktop/New/docs/architecture.md).

## Requirements

- Windows
- Node.js 24+
- npm 11+

## Setup And Commands

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run dist:win
```

## Workflow

1. Start the app.
2. Open Settings and save a Gemini API key.
3. Configure model, voice, thinking mode (`off`/`auto`/`custom`), devices, visual settings, behavior, and diagnostics options (changes are autosaved).
4. Optionally enable `Show Live Timing Panel` in Diagnostics settings to surface per-turn latency checkpoints on the Call page.
5. Return to the Call page and connect a live session.
6. Enable microphone, camera, and screen capture as needed.
7. Use realtime controls while connected.
8. Use `Pause` to keep resumable state; use `Disconnect` for a full reset.
9. Change connect-time options only after disconnect, then reconnect.
10. Monitor transcript, diagnostics, proactive decisions, and optional live timing metrics in real time.

## Security

- Saved API keys never return to the renderer as plaintext.
- The renderer never gets direct Node or Electron access.
- Connect requests are blocked until capability normalization succeeds.
- Connect and media controls always resolve to success or failure.
- Media transport uses binary payloads through message channels.
- Malformed media payloads are dropped with diagnostics warnings.
- On Windows, closing the last app window attempts disconnect, then tears down the worker process tree if needed.

## Notes

- Default model: `gemini-2.5-flash-native-audio-preview-12-2025`.
- API version is auto-selected from Proactive Mode and Affective Dialog settings.
- Thinking mode maps to API budget as: `off -> 0`, `auto -> -1`, `custom -> [128..8192]` (app-side guardrails).
- `Pause` preserves resumable state; `Disconnect` starts a fresh session next time.
- Renderer language is stored locally and applied as a speech-language override on the next connect.
- Default voice list uses Gemini TTS voice names.

## License

MIT
