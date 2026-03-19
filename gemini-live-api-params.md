# Gemini Live API: параметры для `gemini-2.5-flash-native-audio-preview-12-2025` + статус реализации

Дата проверки: **2026-03-19**.

Легенда:
- `✅` реализовано
- `⚠️` частично (есть в коде, но ограничено/не выводится полностью в UI)
- `❌` не реализовано

Источники:
- [Live API WebSocket reference](https://ai.google.dev/api/live)
- [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [Live API tools](https://ai.google.dev/gemini-api/docs/live-api/tools)
- [Live API session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)
- `@google/genai` 1.45.0

Проверка реализации сделана по коду проекта (`src/worker/live/*`, `src/main/ipc/live.ipc.ts`, `src/shared/types/settings.ts`, `src/renderer/pages/SettingsPage.tsx`).

## 1) Параметры подключения (`LiveConnectConfig`)

### Базовые
- `responseModalities` — что это: в каком формате модель отвечает (`TEXT/AUDIO/IMAGE`) — **`⚠️`** (в проекте всегда `AUDIO`)
- `temperature` — что это: уровень случайности генерации (выше = более креативно) — **`❌`**
- `topP` — что это: nucleus sampling (ограничение выборки по суммарной вероятности) — **`❌`**
- `topK` — что это: ограничение количества кандидатов токенов — **`❌`**
- `maxOutputTokens` — что это: лимит длины ответа — **`❌`**
- `seed` — что это: сид для воспроизводимости похожих ответов — **`❌`**
- `generationConfig` — что это: общий объект расширенной генерации — **`⚠️`** (не передаётся как полный настраиваемый блок)

### Речь / голос
- `speechConfig` — что это: настройки синтеза речи модели — **`✅`**
- `speechConfig.languageCode` — что это: язык озвучки модели (`en`, `ru` и т.д.) — **`✅`**
- `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` — что это: имя предустановленного голоса — **`✅`**
- `speechConfig.voiceConfig.replicatedVoiceConfig` — что это: кастомный голос по твоему аудио-сэмплу — **`❌`**
- `speechConfig.multiSpeakerVoiceConfig` — что это: TTS на двух спикеров — **`❌`**

### Транскрипции
- `inputAudioTranscription` — что это: текстовая расшифровка речи пользователя — **`✅`**
- `inputAudioTranscription.languageCodes` — что это: подсказка языков для распознавания — **`❌`**
- `outputAudioTranscription` — что это: текстовая расшифровка речи модели — **`✅`**
- `outputAudioTranscription.languageCodes` — что это: подсказка языков для расшифровки исходящего аудио — **`❌`**

### Медиа
- `mediaResolution` — что это: уровень детализации анализа видео/изображений (`low/medium/high`) — **`✅`**

### Thinking / эмоции / проактивность
- `thinkingConfig` — что это: управление «думающим» режимом — **`⚠️`**
- `thinkingConfig.thinkingBudget` — что это: сколько токенов разрешено тратить на thinking — **`✅`**
- `thinkingConfig.includeThoughts` — что это: возвращать ли thought-блоки в ответе — **`❌`**
- `thinkingConfig.thinkingLevel` — что это: уровень thinking (`MINIMAL/LOW/MEDIUM/HIGH`) — **`❌`**
- `enableAffectiveDialog` — что это: адаптация ответа к эмоциям пользователя — **`✅`**
- `proactivity.proactiveAudio` — что это: разрешение модели самой инициировать ответ по контексту аудио — **`✅`**

### Контекст / сессия
- `systemInstruction` — что это: системные правила поведения модели — **`✅`**
- `tools` — что это: список инструментов (function calling/search/url context и т.д.) — **`❌`**
- `sessionResumption` — что это: восстановление состояния после реконнекта — **`⚠️`**
- `sessionResumption.handle` — что это: токен/handle для продолжения сессии — **`✅`**
- `sessionResumption.transparent` — что это: прозрачный resume с индексом последнего подтверждённого сообщения — **`❌`**
- `contextWindowCompression` — что это: сжатие длинного контекста, чтобы влезать в окно токенов — **`⚠️`**
- `contextWindowCompression.triggerTokens` — что это: порог, после которого включается сжатие — **`✅`** (фиксирован)
- `contextWindowCompression.slidingWindow.targetTokens` — что это: до какого размера ужимать контекст — **`✅`** (фиксирован)

### Realtime input behavior
- `realtimeInputConfig` — что это: правила обработки realtime-ввода — **`⚠️`**
- `realtimeInputConfig.automaticActivityDetection` — что это: авто-определение начала/конца речи (VAD) — **`✅`**
- `realtimeInputConfig.activityHandling` — что это: прерывать ли модель при новой активности пользователя — **`⚠️`** (жёстко `START_OF_ACTIVITY_INTERRUPTS`)
- `realtimeInputConfig.turnCoverage` — что это: что входит в пользовательский turn (только активность или весь поток) — **`⚠️`** (жёстко `TURN_INCLUDES_ONLY_ACTIVITY`)
- `explicitVadSignal` — что это: ручная сигнализация `activityStart/activityEnd` вместо авто-VAD — **`❌`**

### Технические
- `httpOptions` — что это: сетевые опции HTTP-клиента SDK — **`❌`**
- `abortSignal` — что это: отмена/таймаут подключения — **`✅`**

## 2) Runtime-методы в сессии

### `sendRealtimeInput(...)`
- `audio` — что это: отправка PCM-чанков микрофона — **`✅`**
- `video` — что это: отправка JPEG-кадров камеры/экрана — **`✅`**
- `text` — что это: realtime-текст без формирования полного user turn — **`✅`** (используется для hidden proactive hints)
- `audioStreamEnd` — что это: сигнал «аудиопоток закрыт/пауза микрофона» — **`✅`**
- `activityStart` — что это: ручной сигнал начала активности пользователя — **`❌`**
- `activityEnd` — что это: ручной сигнал окончания активности — **`❌`**
- `media` / `mediaChunks` — что это: универсальный канал мультимедиа — **`❌`**

### `sendClientContent(...)`
- `turns` — что это: классическая отправка user-сообщения в историю диалога — **`✅`**
- `turnComplete` — что это: явный маркер «ход пользователя завершён» — **`✅`**

### `sendToolResponse(...)`
- `functionResponses[]` — что это: ответы твоего кода на вызовы функций модели — **`❌`**

## 3) Tools / function calling

- `tools[]` в connect config — что это: подключение инструментов на уровне сессии — **`❌`**
- `functionDeclarations[]` — что это: описание функций, которые модель может вызвать — **`❌`**
- `functionCallingConfig.mode` — что это: режим вызовов (`AUTO/ANY/NONE/VALIDATED`) — **`❌`**
- `functionCallingConfig.allowedFunctionNames` — что это: белый список разрешённых функций — **`❌`**
- обработка `toolCall` от сервера — что это: получение запроса на вызов функции — **`❌`**
- обработка `toolCallCancellation` — что это: отмена ранее выданного tool call — **`❌`**
- отправка `FunctionResponse` обратно — что это: возврат результата выполнения функции модели — **`❌`**

## 4) Серверные поля: что реально обрабатывается

### Обрабатывается
- `serverContent.modelTurn` — что это: контент ответа модели (части turn) — **`✅`**
- `serverContent.turnComplete` — что это: маркер завершения turn модели — **`✅`**
- `serverContent.generationComplete` — что это: маркер окончания генерации — **`✅`**
- `serverContent.interrupted` — что это: ответ модели был прерван новым вводом — **`✅`**
- `serverContent.waitingForInput` — что это: модель ожидает дальнейший ввод — **`✅`**
- `serverContent.inputTranscription` — что это: текст распознанной речи пользователя — **`✅`**
- `serverContent.outputTranscription` — что это: текст речи самой модели — **`✅`**
- `goAway.timeLeft` — что это: время до принудительного закрытия соединения — **`✅`** (логируется в diagnostics)
- `sessionResumptionUpdate.newHandle` — что это: новый handle для resume — **`✅`**
- `sessionResumptionUpdate.resumable` — что это: можно ли безопасно резюмировать сейчас — **`✅`**
- `sessionResumptionUpdate.lastConsumedClientMessageIndex` — что это: индекс последнего подтверждённого клиентского сообщения — **`⚠️`** (приходит, но полноценно для прозрачной буферизации не используется)

### Не обрабатывается отдельно
- `groundingMetadata` — что это: метаданные grounding (поиск/источники) — **`❌`**
- `urlContextMetadata` — что это: метаданные инструмента `urlContext` — **`❌`**

## 5) Что доступно в UI сейчас

- модель — что это: выбор ID модели Live API — **`✅`**
- голос (`voiceName`) — что это: выбор предустановленного голоса — **`✅`**
- язык речи (`speechConfig.languageCode`) — что это: язык синтеза — **`✅`**
- `thinkingBudget` — что это: ручная настройка thinking-бюджета — **`✅`**
- `enableAffectiveDialog` — что это: переключатель эмпатичного режима — **`✅`**
- `proactiveMode` (`off/pure/assisted`) — что это: уровень проактивности оркестратора — **`✅`**
- авто VAD + `sensitivity/silence/prefix` — что это: настройки детекта речи — **`✅`**
- manual VAD toggle — что это: переключатель ручного VAD — **`⚠️`** (тумблер есть, но `activityStart/activityEnd` не отправляются)
- `mediaResolution` — что это: уровень детализации видео-входа — **`✅`**
- input/output transcription enable — что это: включение/выключение транскрипций — **`✅`**

## 6) Жёсткая проверка: удалялось ли что-то из конфигов проекта

Проверка выполнена командами:
- `git status --short`
- `git diff --name-only`
- `git diff -- src/shared/types/settings.ts src/shared/schema/settingsSchema.ts src/main/ipc/live.ipc.ts src/worker/live/liveSessionManager.ts src/worker/live/capabilityNormalizer.ts README.md docs/architecture.md`

Результат:
- В рабочем дереве нет изменений в коде и конфиг-файлах проекта.
- Изменён только новый файл документации: `gemini-live-api-params.md`.

Итог: **из runtime-конфигов/кода ничего не удалялось**.

## 7) Краткий итог по реализации

Реализовано ядро Live-клиента: голосовой connect, аудио/видео realtime-ввод, `thinkingBudget`, affective dialog, proactive audio, session resumption (через `handle`), context compression, вход/выход транскрипции.

Пока не реализовано: tools/function calling, ручные `activityStart/activityEnd`, расширенные поля thinking (`includeThoughts`, `thinkingLevel`), sampling-параметры (`temperature/topP/topK/maxOutputTokens/seed`), и продвинутая обработка `groundingMetadata/urlContextMetadata`.
