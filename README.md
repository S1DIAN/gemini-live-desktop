# Gemini Live Desktop

> ⚠️ This is an unofficial desktop client for Google Gemini Live.
> This project is not affiliated with, endorsed by, or sponsored by Google.

Gemini Live Desktop is a Windows desktop app for running real-time Gemini Live sessions in one place. It is designed for people who want voice-first conversations, optional camera/screen context, and clear diagnostics when tuning reliability and latency.

## Why This Desktop App

I built this desktop client because, at that time, proactive mode did not work reliably for me in Google AI Studio. It was also hard to track what was failing and why due to limited diagnostics visibility. In this app, I added more flexible controls and clearer insight into live-session behavior, so proactive flows can be tuned and debugged more precisely.

## Model Options

- `gemini-2.5-flash-native-audio-preview-12-2025` (`Gemini 2.5 Flash Native Audio`) is the default profile for native-audio conversations.
- `gemini-3.1-flash-live-preview` (`Gemini 3.1 Flash Live Preview`) is the newest supported live profile in this app.

## What This App Gives You

- A local single-user desktop client with encrypted Gemini API key storage.
- Quick model switching between `Gemini 2.5 Flash Native Audio` and the newer `Gemini 3.1 Flash Live Preview`.
- Real-time session controls for microphone, camera, screen sharing, and interruption behavior.
- Chat-style transcript UI with turn-final model responses and optional collapsible thinking metadata.
- Fast runtime tuning for model, voice, assistant mode, and thinking settings (with autosave).
- Diagnostics tooling for reconnect issues, turn latency checkpoints, and exportable session logs.
- Runtime language switching (`English`/`Russian`) and resumable `Pause`/full-reset `Disconnect` flows.

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
2. Open Settings and paste a Gemini API key in the API field (saved automatically).
3. Configure model, voice, interruption behavior (`Allow Interruption`), thinking mode (`off`/`auto`/`custom`), devices, visual settings, behavior (including proactive cooldown and significant-frame streak), and diagnostics options (changes are autosaved).
4. Optionally open `Voice` dropdown and use `Play`/`Pause` next to any listed voice to preview it (short TTS sample, no Live connect required).
5. Optionally enable `Show Live Timing Panel` in Diagnostics settings to surface per-turn latency checkpoints on the Call page.
6. Return to the Call page and connect a live session.
7. Enable microphone, camera, and screen capture as needed.
8. Use realtime controls while connected.
9. Use `Pause` to keep resumable state; use `Disconnect` for a full reset.
10. Change connect-time options only after disconnect, then reconnect.
11. Monitor transcript, diagnostics, proactive decisions, and optional live timing metrics in real time.

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
- Supported models are `gemini-2.5-flash-native-audio-preview-12-2025` and `gemini-3.1-flash-live-preview`.
- API version and capability toggles are auto-normalized by selected model profile (`gemini 3.1 flash live preview` is fixed to `v1beta` and disables proactive/affective features).
- Thinking behavior is model-profile aware: `gemini 2.5 flash native audio` remains budget-driven, while `gemini 3.1 flash live preview` is level-first.
- `Pause` preserves resumable state; `Disconnect` starts a fresh session next time.
- Renderer language is stored locally and applied as a speech-language override on the next connect.
- Default voice list uses Gemini TTS voice names.

## Not Implemented Yet (Possible Next Steps)

- Live API tools/function calling integration is not wired yet (`tools` in connect config, tool-call handling, and `sendToolResponse` flow).
- Manual VAD signaling is not wired end-to-end yet (`activityStart` / `activityEnd`); automatic activity detection remains active.
- Only prebuilt voices are supported in session speech config; replicated/custom voice and multi-speaker voice paths are not implemented.
- Advanced generation controls are not exposed in app settings yet (`temperature`, `topP`, `topK`, `maxOutputTokens`, `seed`).
- Speech-language options in runtime settings are currently limited to `en` and `ru`.

## License

MIT
