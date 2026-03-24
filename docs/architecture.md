# Architecture

## Layers

The app is split into five runtime layers:

1. `main`
   Creates the Electron window, owns persistent storage, secure key storage, diagnostics export, display-media selection, IPC registration, worker lifecycle and shutdown semantics.
2. `preload`
   Exposes narrow bridges to the renderer for settings, live session control, media transport and diagnostics. It does not expose raw Electron or Node APIs.
3. `renderer`
   Renders the `CallPage`, `SettingsPage` and `DiagnosticsPage`, manages Zustand stores, owns browser media capture, dock-anchored previews, JPEG encoding, frame diffing, local audio playback, proactive hint orchestration, proactivity metrics aggregation, chat-style transcript presentation, and localized UI dictionaries with runtime language selection.
4. `worker`
   Owns the Gemini Live session, reconnect logic, session resumption, capability normalization, bootstrap generation, ordered client content and event mapping.
5. `shared`
   Contains cross-process types and Zod schemas. Shared contracts are the source of truth for IPC payloads, settings, diagnostics events and session snapshots.

## Invariants

- Saved plaintext API keys never leave the `main` or `worker` boundary.
- The live session never runs in the renderer.
- Command IPC and streaming media transport are separate mechanisms.
- Worker commands are delivered only after an explicit worker-ready handshake from the utility process.
- In packaged builds the utility process is started from a real filesystem bootstrap entrypoint, which then requires the bundled worker code from the app archive.
- Streaming media transport uses binary payloads through message channels.
- Malformed media payloads from message channels are dropped and logged; they must not crash the worker.
- Screen and camera are represented as periodic JPEG frames with `latest-frame-wins`.
- Every connect attempt must pass capability normalization before the worker opens a session.
- Requested API version is auto-derived from session capabilities (`proactiveMode` and `enableAffectiveDialog`) before connect commands are sent.
- Runtime capability normalization, not the UI, is the final authority for effective live config.
- The current default model lives in `defaultSettings` and is `gemini-2.5-flash-native-audio-preview-12-2025`; the current default voice is `Aoede`.
- Thinking mode is explicitly modeled as `off`/`auto`/`custom` in app settings and mapped to Live API budget as `0`/`-1`/custom budget before worker connect.
- Gemini Developer API live connect keeps automatic activity detection enabled; client-side manual activity signaling (`activityStart`/`activityEnd`) is not wired yet.
- Microphone pause events must trigger `audioStreamEnd` delivery while automatic activity detection is active to flush cached audio.
- Closing the last window on Windows must attempt a short graceful session disconnect, then tear down the worker process tree and terminate the app fully.
- Connect and control actions must terminate with an explicit success or failure outcome; a worker startup failure must not leave renderer controls stuck in a pending state.
- Renderer session controls must expose immediate inline UX feedback for pending, success and failure states independently of the Diagnostics page.
- Session teardown must support two explicit modes:
  - `pause`: close transport while preserving resumable state for reconnecting to the same live chat.
  - `terminate`: close transport and clear resumable state so the next connect starts a new live session; renderer transcript history is cleared immediately on successful terminate.
- Renderer route navigation must not implicitly stop active local media capture; mic/camera/screen are runtime session controls and change only through explicit toggles or terminal session-state teardown.
- Connect-time setup controls in the renderer are locked during active live session states (`connecting`, `connected`, `reconnecting`, `disconnecting`) and while paused session continuation is retained; realtime renderer tuning remains editable.
- Renderer language switching controls a connect-time speech-language override (`speechConfig.languageCode`) for the next connect; it must not force reconnect during an active session.
- Selected renderer locale is stored in browser localStorage and applied immediately across all routes; it is only turned into a speech-language override on the next connect.
- Model transcript events emitted to the renderer chat must be turn-final only (`generationComplete`/`turnComplete`) to prevent chunked model bubbles.
- Model transcript events may include API-native thought metadata (`thought`, optional `thoughtSignature`) derived from Gemini `Part.thought`/`Part.thoughtSignature` for collapsible thinking UI.

## Runtime Data Flow

### Settings And Key Storage

- The renderer edits settings through typed IPC.
- `main` validates and persists settings in a versioned JSON file.
- API version in settings is auto-derived (`v1alpha` for proactive or affective features, otherwise `v1beta`) during normalization and save.
- Settings normalization performs a lightweight proactive-tuning migration for legacy defaults (`changeThreshold=0.22` -> `0.12`, `maxAutonomousCommentFrequencyMs=12000` -> `6000`) to reduce assisted commentary latency.
- Settings normalization also applies legacy thinking migration so old persisted `thinkingBudget` values map into explicit thinking mode (`off`/`auto`/`custom`) without breaking existing installs.
- API keys are stored separately as an encrypted blob through `safeStorage`.
- The renderer can observe key presence and a masked label, but never the saved plaintext key.

### Localization

- Renderer localization is implemented with in-process translation dictionaries (`en`, `ru`) under `src/renderer/i18n`.
- Selected locale is persisted in renderer local storage and applied immediately across routes and components.
- Renderer locale (`en`/`ru`) is applied as a connect-time override in live connect payloads (`speechConfig.languageCode`) without rewriting persisted settings.
- Runtime normalization may disable explicit `speechConfig.languageCode` for known incompatible model/language combinations to prevent reconnect loops caused by backend `Unsupported language code` closes.

### Connect Pipeline

1. Renderer requests connect.
2. Main loads persisted settings, decrypts the API key and derives the requested API version from proactive or affective settings.
3. Main forwards a connect command to the worker only after the worker-ready handshake has completed.
4. Worker runs `CapabilityNormalizer`.
5. If normalization fails, connect aborts before any live session is created.
6. If normalization succeeds, worker logs the normalization decisions and effective session snapshot, builds bootstrap context, then opens the Gemini Live session.
   For Gemini API compatibility, session resumption uses the resume handle only and does not send the Vertex-only `transparent` flag.
   Live transcription uses an empty `AudioTranscriptionConfig`; Gemini Developer API live connect does not accept `languageCodes`.
   Thinking config is sent with normalized budget plus optional thought summaries and optional thinking level (`model default` leaves level unset).
   Manual VAD mode is normalized off in this client until `activityStart`/`activityEnd` signaling is implemented end-to-end.
   The Call page surfaces both the requested API version and the runtime effective version, plus inline error text for failed session actions.

### Media Pipeline

- The renderer captures microphone audio with Web Audio, resamples to 16kHz mono PCM and sends small binary chunks through a message channel.
- The renderer assigns a per-replica `turnId` at speech start (local RMS/VAD heuristic for telemetry) and tags outgoing microphone chunks while the turn is active.
- The renderer captures screen and camera locally, downsizes frames, encodes them to JPEG, and sends binary frame payloads through a message channel with `latest-frame-wins`; the worker forwards those frames via `sendRealtimeInput.video`.
- In assisted proactive mode, screen-diff evaluation and hidden hint decisions are applied only after the corresponding frame send attempt completes, keeping proactive commentary aligned to the latest delivered frame.
- Worker forwards renderer proactive hidden hints via `sendRealtimeInput.text` so proactive trigger text follows the realtime media path.
- Worker buffers model transcription chunks and thought chunks separately, and emits final model chat messages only after turn completion. Thought messages are tagged with transcript metadata (`thought=true`).
- When microphone capture is paused or session teardown starts, the renderer emits a pause telemetry event and the worker sends `sendRealtimeInput({ audioStreamEnd: true })` to flush pending audio on the Live API side.
- If renderer media message ports detach, the renderer requests new media transport ports and retries one delivery before surfacing a transport error and stopping the affected media control.
- Renderer microphone capture listens for unexpected track-end and reports an explicit media failure path instead of leaving mic UI state stale.
- If a stored microphone device ID is unavailable, renderer microphone capture retries on the system default input device to avoid dead input paths.
- The worker base64-encodes only at the final SDK boundary when building Gemini blobs.
- Renderer sends sparse voice telemetry markers (`mic_*`, `vad_*`, playback markers, `turn_aborted`) through command IPC; worker correlates them with chunk upload and server/model events.
- With Gemini Developer API automatic activity detection enabled, there is no explicit per-turn SDK commit call for microphone turns. `client_turn_commit_sent` is therefore a diagnostic name for the local renderer/worker handoff when VAD closes a turn, while `server_turn_ack_received` is the first correlatable server message for that turn.

### Session And Diagnostics

- Worker emits structured events to main.
- Main keeps diagnostics in an in-memory session buffer, mirrors them to process console output and forwards them to the renderer.
- Renderer-originated diagnostics that are created locally (for proactive orchestration and metrics) are mirrored back into main through a dedicated diagnostics IPC channel so export includes a single merged timeline.
- Diagnostics are not persisted across app restarts; a file is created only when the user explicitly runs diagnostics export.
- Renderer sends an explicit disconnect mode through IPC (`pause` or `terminate`); worker state clearing differs by mode but both must end with terminal session status feedback.
- Diagnostics page shows the effective config even for failed connect attempts, plus worker lifecycle and timeout details.
- Diagnostics must include:
  - capability normalization decisions
  - effective session snapshot
  - worker launch, pid and handshake timing
  - connect start, finish or timeout timing
  - `GoAway`
  - `SessionResumptionUpdate`
  - `generationComplete`
  - `interrupted`
  - reconnect attempts
  - serialized connect and reconnect error details
  - proactive trigger and skip decisions
  - proactivity metrics (`proactivity_evaluation_count`, `proactivity_autonomous_start_count`, `proactivity_blocked_by_reason`, `ms_since_last_user_audio_at_proactivity_eval`, `ms_since_last_noise_turn_at_proactivity_eval`, `noise_turn_ratio`, `idle_eligible_ratio`, `proactivity_cooldown_active_ratio`, `proactivity_trigger_detected_count`, `response_start_type_count`, `proactivity_trigger_to_model_start_ms`, `proactivity_session_summary`)
  - per-turn latency checkpoints with `turnId` correlation (`mic_first_frame_captured`, `vad_speech_started`, `vad_speech_ended`, `client_turn_commit_sent`, `audio_stream_upload_started`, `audio_stream_upload_finished`, `server_turn_ack_received`, `server_turn_detected`, `model_response_started`, `first_model_audio_received`, `playback_started`)
  - per-turn aggregate `turn_latency_summary`, including mode context (`proactiveMode`, `proactiveAudioEnabled`, `apiVersion`, `customActivityDetectionEnabled`) and commit-to-ack latency
  - classified shutdown and abort events (`session_closed`, `turn_aborted`) with reason metadata

## Media Permissions

Screen capture is handled through a controlled flow:

1. Main enumerates desktop sources.
2. Renderer shows a picker.
3. Renderer arms a source in main.
4. Main resolves `getDisplayMedia` through `setDisplayMediaRequestHandler`.
5. Denied, cancelled and revoked states are propagated into diagnostics.

Camera and microphone use browser permission prompts and renderer-side error reporting.

## Worker Boundaries

The worker isolates:

- Gemini client creation
- live connect and disconnect
- ordered client content
- realtime input forwarding
- reconnect policy
- session resumption handles
- effective live setup

The worker does not own UI state or browser media capture.

## Module Boundaries

- `LiveSessionManager` owns session lifecycle and adapter binding.
- `LiveSessionManager` also owns per-turn latency context correlation between renderer telemetry, local implicit turn finalization, server ack/detection, model callbacks and playback completion, plus response start-type classification (`reactive_user_turn`, `autonomous_proactive`, `unknown`) and proactive trigger-to-model-start latency emission.
- `SessionControls` owns the fixed call dock, including the compact live camera/screen preview tiles shown when local capture is enabled and the dock-level quick AI settings drawer (model/voice/assistant-mode/thinking tuning).
- `ReconnectManager` owns retry timing and resume or fresh-session fallback.
- `CapabilityNormalizer` owns effective config derivation and hard gating.
- `BootstrapBuilder` owns startup and system-instruction composition.
- Live speech output language is configured at connect time through `speechConfig.languageCode` from persisted settings, independent of bootstrap prompt text.
- `FrameDiffService` owns screen-difference scoring.
- `ProactiveOrchestrator` owns autonomous hint decisions only, including runtime-idle gating that accepts either server `waitingForInput` or local silence/playback state; local hinting is active for `pure` and `assisted` modes and disabled only when mode is `off`.
- Call-page proactive evaluation applies mode-aware effective tuning before orchestration (`pure` lowers effective threshold and interval more aggressively than `assisted`) and emits both effective and user-configured tuning values in diagnostics for traceability.
- Renderer `ProactivityMetricsTracker` owns proactivity metric counters, block-reason aggregation, idle/cooldown uptime accounting, and end-of-session proactivity summary emission.
- Renderer i18n module owns translation dictionaries and current locale state.
- `src/main/app.ts` wires app bootstrap, lifecycle and shutdown.
- `src/main/settingsRepository.ts` owns versioned settings persistence and normalization entry points.
- `src/main/security/secureStorage.ts` owns encrypted API-key storage.
- `src/main/ipc/*.ts` expose settings, live, diagnostics and display-media IPC.
- `src/main/workers/liveWorkerLauncher.ts` owns the utility-process handshake, command queueing, connect watchdog and process-tree shutdown.
- `src/preload/bridges/*.ts` expose the minimal renderer bridge surface.
- `src/renderer/app/routes.tsx` owns top-level navigation.
- `src/renderer/components/layout/Sidebar.tsx` owns the left navigation rail and pinned bottom locale switcher UI (`en`/`ru`).
- `src/renderer/pages/*` compose page-level UI only.
- `src/renderer/components/TranscriptPanel.tsx` renders the chat-style transcript feed, and `src/renderer/components/SessionControls.tsx` owns the bottom dock plus compact preview tiles.
- `src/renderer/services/audio/*` owns local capture and playback control.
- `src/renderer/services/media/*` owns screen and camera capture plus frame encoding.
- `src/renderer/services/live/*` owns renderer-side live orchestration and proactivity tracking.
- `src/renderer/state/*` owns the Zustand session, settings, diagnostics and transcript stores.
- `src/worker/liveWorker.ts` is the utility-process entrypoint.
- `src/worker/live/*` owns connect normalization, bootstrap assembly, session management and reconnect policy.
- `src/shared/*` owns wire schemas, shared types and shared utilities; these are the source of truth for process boundaries.

## Refactoring Guidance

- Keep Electron-only modules out of `shared` and `renderer`.
- Keep business rules out of React components.
- If a feature changes wire contracts, update `src/shared/types`, `src/shared/schema`, `README.md` and this file together.
- If a change impacts architecture, boundaries, lifecycle or invariants, update this document in the same change.
- If setup, workflow or other high-level project usage changes, update `README.md` in the same change.
