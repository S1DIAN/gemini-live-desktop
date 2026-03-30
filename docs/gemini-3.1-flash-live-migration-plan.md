# Gemini 3.1 Flash Live: Migration And Model-Switch Plan

Updated: 2026-03-28

## Scope

This document is a preparation artifact for migrating the current app from:

- `gemini-2.5-flash-native-audio-preview-12-2025`

to:

- `gemini-3.1-flash-live-preview`

and adding reliable runtime switching between model profiles.

## Sources (Official)

- [Gemini 3.1 Flash Live Preview (model page)](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview?hl=ru#migrating)
- [Gemini 3.1 Flash Live Preview (markdown source)](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview.md.txt)
- [Gemini API Models index](https://ai.google.dev/gemini-api/docs/models)
- [Live API capabilities guide](https://ai.google.dev/gemini-api/docs/live-guide)
- [Live API tool use guide](https://ai.google.dev/gemini-api/docs/live-tools)
- [Live API reference](https://ai.google.dev/api/live)

## Confirmed Changes In `gemini-3.1-flash-live-preview`

Based on the model migration section:

1. Model ID changed.
- From `gemini-2.5-flash-native-audio-preview-12-2025`
- To `gemini-3.1-flash-live-preview`

2. Thinking config changed.
- `thinkingLevel` is the primary control (`minimal|low|medium|high`).
- Migration guidance explicitly says to move from `thinkingBudget` to `thinkingLevel`.
- Default level is `minimal` (latency-optimized).

3. Server event payload expectation changed.
- A single `BidiGenerateContentServerContent` event may contain multiple parts at once (for example audio + transcript in one event).
- Client handlers must process all parts per event.

4. Text input path changed for ongoing conversation.
- `send_client_content` is for seeding initial context history.
- Conversation-time text updates should use `send_realtime_input`.

5. Turn coverage default changed.
- Default is now `TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO` (instead of prior `TURN_INCLUDES_ONLY_ACTIVITY` default behavior).
- Migration note recommends sending video frames only when audio activity is present to limit extra costs.

6. Feature support differences.
- Proactive audio: not supported in `3.1 Flash Live` (per migration note).
- Affective dialog: not supported in `3.1 Flash Live` (per migration note).
- Async function calling: not supported (sync only).

7. History seeding requirements are explicit in Live API docs.
- For `gemini-3.1-flash-live-preview`, `send_client_content` history seeding requires `historyConfig.initialHistoryInClientContent = true`.
- After first model turn, text should be sent via `send_realtime_input` (`text`).

8. Native-audio language behavior is a migration risk.
- Live capabilities guide states native audio output models automatically choose language and do not support explicitly setting language code.
- Current app behavior still applies `speechConfig.languageCode` at connect time, so this path needs model-aware handling.

## Current App Impact (Codebase Audit)

### 1) Model default is still hardcoded to 2.5

- [src/shared/types/settings.ts](C:/Users/darkg/Desktop/New/src/shared/types/settings.ts)

Current default:
- `model: "gemini-2.5-flash-native-audio-preview-12-2025"`

### 2) App still uses `thinkingBudget` heavily

- [src/main/ipc/live.ipc.ts](C:/Users/darkg/Desktop/New/src/main/ipc/live.ipc.ts)
- [src/shared/types/settings.ts](C:/Users/darkg/Desktop/New/src/shared/types/settings.ts)
- [src/shared/schema/settingsSchema.ts](C:/Users/darkg/Desktop/New/src/shared/schema/settingsSchema.ts)
- [src/renderer/pages/SettingsPage.tsx](C:/Users/darkg/Desktop/New/src/renderer/pages/SettingsPage.tsx)
- [src/renderer/components/SessionControls.tsx](C:/Users/darkg/Desktop/New/src/renderer/components/SessionControls.tsx)

`thinkingLevel` already exists in settings/UI, but budget logic remains first-class and is always mapped into connect payload.

### 3) Text sending path is not 3.1-aligned

- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)

Current behavior:
- `proactive_hidden_hint` -> `sendRealtimeInput({ text })`
- Other text sources (`manual_user_text`, `startup_instruction`) -> `sendClientContent(...)`

This contradicts 3.1 migration guidance for in-session text updates.

Related gap:
- No explicit `historyConfig.initialHistoryInClientContent` setup is currently wired for 3.1 history seeding mode.

### 4) Unsupported 3.1 features are still exposed and normalized as active

- [src/worker/live/capabilityNormalizer.ts](C:/Users/darkg/Desktop/New/src/worker/live/capabilityNormalizer.ts)
- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)
- [src/renderer/pages/SettingsPage.tsx](C:/Users/darkg/Desktop/New/src/renderer/pages/SettingsPage.tsx)
- [src/renderer/components/SessionControls.tsx](C:/Users/darkg/Desktop/New/src/renderer/components/SessionControls.tsx)

Current behavior still supports:
- `proactiveMode` -> `proactivity.proactiveAudio`
- `enableAffectiveDialog`
- auto-upgrade to `v1alpha` when proactive/affective enabled

For `3.1 Flash Live`, this needs model-aware disabling instead of forcing alpha.

### 5) Turn coverage currently hardcoded

- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)

Current connect config explicitly sets:
- `turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY`

This bypasses new default, but must be validated against desired product behavior and cost profile.

### 6) Speech-language override strategy likely conflicts with 3.1/native-audio guidance

- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)
- [src/worker/live/capabilityNormalizer.ts](C:/Users/darkg/Desktop/New/src/worker/live/capabilityNormalizer.ts)
- [src/main/ipc/live.ipc.ts](C:/Users/darkg/Desktop/New/src/main/ipc/live.ipc.ts)

Current behavior:
- always builds `speechConfig.languageCode` from persisted locale/override.

Risk:
- official native-audio guidance says explicit language code is not supported; this must be profile-gated.

### 7) Multi-part server handling looks mostly compatible but needs regression tests

- [src/worker/live/eventMapper.ts](C:/Users/darkg/Desktop/New/src/worker/live/eventMapper.ts)
- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)

The code already iterates model parts for audio and text/thought extraction, but this must be explicitly tested with mixed-part single-event payloads.

## Implementation Plan For Safe Model Switching

## Phase 1: Introduce model capability profiles (required)

Create a centralized profile map (suggested new module):
- `src/shared/constants/liveModelProfiles.ts`

For each model profile define:
- `supportsProactiveAudio`
- `supportsAffectiveDialog`
- `supportsThinkingBudget`
- `supportsThinkingLevel`
- `preferredThinkingControl` (`level` vs `budget`)
- `preferredTextTransport` (`realtime_input` vs `client_content`)
- `recommendedApiVersion`
- `recommendedTurnCoverage`

Purpose:
- remove hardcoded model-specific branching scattered across worker/main/renderer
- make switching deterministic and testable

## Phase 2: Model-aware normalization (required)

Update normalization path:
- [src/main/ipc/live.ipc.ts](C:/Users/darkg/Desktop/New/src/main/ipc/live.ipc.ts)
- [src/shared/types/settings.ts](C:/Users/darkg/Desktop/New/src/shared/types/settings.ts)
- [src/worker/live/capabilityNormalizer.ts](C:/Users/darkg/Desktop/New/src/worker/live/capabilityNormalizer.ts)

Changes:
1. Replace global auto-rule (`proactive/affective => v1alpha`) with model-profile-aware API version selection.
2. When model does not support proactive/affective:
- force-disable in effective config
- emit diagnostics decision with explicit reason
- keep persisted setting (optional) but mark as ignored for active model
3. Thinking config:
- for 3.1 profile prioritize `thinkingLevel`
- keep `thinkingBudget` only for backward compatibility where needed
4. Speech language config:
- when model profile is native-audio and docs indicate auto language selection, omit `speechConfig.languageCode`.

## Phase 3: Fix text transport routing (required)

Update:
- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)

Policy:
1. Use `sendRealtimeInput({ text })` for conversation-time text when active model profile requires it (`3.1`).
2. Keep `sendClientContent` only for explicit history seeding/startup context append where appropriate.
3. Add diagnostics event showing which transport path was used.
4. If `sendClientContent` is used for initial history in 3.1, wire `historyConfig.initialHistoryInClientContent = true` in connect setup.

## Phase 4: UI and settings gating by model (required)

Update:
- [src/renderer/pages/SettingsPage.tsx](C:/Users/darkg/Desktop/New/src/renderer/pages/SettingsPage.tsx)
- [src/renderer/components/SessionControls.tsx](C:/Users/darkg/Desktop/New/src/renderer/components/SessionControls.tsx)
- [src/renderer/i18n/translations.ts](C:/Users/darkg/Desktop/New/src/renderer/i18n/translations.ts)

Changes:
1. Add model selector presets:
- `gemini-2.5-flash-native-audio-preview-12-2025`
- `gemini-3.1-flash-live-preview`
2. On model change, show capability badges/warnings.
3. Disable unsupported toggles for current model (`proactive`, `affective`) with explanatory help text.
4. Thinking UI:
- if model profile prefers level, make level primary and budget secondary/hidden.

## Phase 5: Video-turn and cost policy (required)

Update:
- [src/worker/live/liveSessionManager.ts](C:/Users/darkg/Desktop/New/src/worker/live/liveSessionManager.ts)
- [src/renderer/pages/CallPage.tsx](C:/Users/darkg/Desktop/New/src/renderer/pages/CallPage.tsx)

Choose one strategy and document it:
1. Keep explicit `TURN_INCLUDES_ONLY_ACTIVITY` to preserve current semantics/cost.
2. Move to new default behavior and gate video upload by audio activity windows.

Either way:
- expose the effective policy in diagnostics to make billing-impact visible.

## Phase 6: Test matrix (required before rollout)

Add/extend tests for:
1. Model profile normalization decisions.
2. API version derivation per selected model.
3. Unsupported feature gating (3.1 + proactive/affective).
4. Text transport path selection by model.
5. Mixed-part server event handling in one message (audio + transcript + thought).
6. Resume/reconnect behavior with both models.

## Minimal Backlog (Execution Order)

1. Add model profile map + wire into normalization.
2. Route text transport by model profile.
3. UI gating and model preset selector.
4. Add diagnostics and regression tests.
5. Run staged rollout with default still on 2.5.
6. Flip default model to 3.1 only after test pass + manual QA.

## Proposed Default Rollout Strategy

1. Keep default model as `2.5` in first migration release.
2. Ship model switcher with clear compatibility hints.
3. Collect diagnostics from real usage.
4. After stability confirmation, switch default to `3.1`.

## Open Questions To Resolve Before Full Migration

1. Should startup hidden instruction be considered history seeding (`sendClientContent`) or realtime text (`sendRealtimeInput`) for 3.1 sessions?
2. Do we keep proactive UI for 3.1 as disabled controls, or hide it completely when 3.1 is selected?
3. Do we retain `thinkingBudget` in persisted schema long-term, or start a settings schema migration to level-first representation?

