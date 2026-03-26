import type { DisplaySourceDescriptor } from "@shared/types/ipc";
import type { SessionStatus } from "@shared/types/live";
import type { ProactiveMode } from "@shared/types/settings";
import type { TranscriptSpeaker, TranscriptStatus } from "@shared/types/transcript";

export type Locale = "en" | "ru";

export interface TranslationDictionary {
  app: {
    brand: string;
    brandEyebrow: string;
    brandEdition: string;
    navigation: {
      call: string;
      settings: string;
      diagnostics: string;
    };
    language: {
      label: string;
      english: string;
      russian: string;
    };
  };
  common: {
    on: string;
    off: string;
    defaultOption: string;
  };
  callPage: {
    heroTitle: string;
    heroSubtitle: string;
    pageTitle: string;
    pageMeta: string;
    assistantModeTitle: string;
    assistantModeDescription: string;
    micLevel: string;
    manualTextTitle: string;
    manualTextPlaceholder: string;
    clearTranscript: string;
    sendText: string;
    actionNames: {
      enableMicrophone: string;
      shareScreen: string;
      startCamera: string;
    };
    mediaSource: {
      microphone: string;
      screen: string;
      camera: string;
    };
    modelHints: {
      meaningfulScreenChange: string;
    };
    messages: {
      connecting: string;
      connectFailed: string;
      pausing: string;
      paused: string;
      connectedReady: string;
      disconnecting: string;
      disconnected: string;
      disconnectedReset: string;
      microphoneDisabled: string;
      microphoneEnabled: string;
      screenStopped: string;
      selectScreenFirst: string;
      screenEndedOutside: string;
      screenStarted: string;
      cameraStopped: string;
      cameraStarted: string;
      microphoneStopped: string;
      controlActionFailed: string;
      voiceTelemetryFailed: string;
      proactiveDecision: string;
      audioTransportDetached: string;
      visualTransportDetached: string;
      microphoneStreamEnded: string;
      microphoneStreamEndedUnexpectedly: string;
      cannotStartScreenWithoutSource: string;
      screenRevoked: string;
      transportFailed: (sourceLabel: string, message: string) => string;
      transportFailedShort: (sourceLabel: string) => string;
      mediaSessionRequired: (action: string) => string;
    };
  };
  sessionControls: {
    statuses: Record<SessionStatus, string>;
    statusCopy: {
      connecting: string;
      connected: string;
      disconnecting: string;
      reconnecting: string;
      disconnected: string;
      idle: string;
      defaultError: string;
    };
    connect: string;
    pause: string;
    disconnect: string;
    connecting: string;
    pausing: string;
    disconnecting: string;
    mic: string;
    cam: string;
    screen: string;
    stopPlayback: string;
  };
  proactiveMode: {
    title: string;
    modes: Record<ProactiveMode, string>;
    requestedApi: string;
    runtimeApi: string;
    notConnectedYet: string;
    errorPrefix: string;
  };
  deviceSelectors: {
    title: string;
    microphone: string;
    output: string;
    camera: string;
    screenSource: string;
    selectSource: string;
    displayKind: Record<DisplaySourceDescriptor["kind"], string>;
  };
  preview: {
    screen: string;
    camera: string;
  };
  transcript: {
    title: string;
    empty: string;
    speaker: Record<TranscriptSpeaker, string>;
    status: Record<TranscriptStatus, string>;
  };
  diagnostics: {
    title: string;
    subtitle: string;
    meta: string;
    exportLogs: string;
    eventCountSuffix: string;
    tableHeaders: {
      level: string;
      category: string;
      message: string;
      time: string;
    };
    summary: string;
    latestStatus: string;
    effectiveSessionSnapshot: string;
    eventTimeline: string;
    noDiagnosticsYet: string;
    noEffectiveConfigYet: string;
    summaryKeys: {
      totalEvents: string;
      errorCount: string;
      warnCount: string;
      latestEvent: string;
      category: string;
      level: string;
      message: string;
      timestamp: string;
      details: string;
    };
  };
  settings: {
    title: string;
    subtitle: string;
    meta: string;
    lockBanner: string;
    sections: {
      api: string;
      audio: string;
      visual: string;
      behavior: string;
      diagnostics: string;
    };
    sectionDescriptions: {
      api: string;
      audio: string;
      visual: string;
      behavior: string;
      diagnostics: string;
    };
    help: {
      iconAriaLabel: string;
      sections: {
        api: string;
        audio: string;
        visual: string;
        behavior: string;
        diagnostics: string;
      };
      fields: {
        savedKey: string;
        model: string;
        apiVersionAuto: string;
        voice: string;
        allowInterruption: string;
        thinkingMode: string;
        thinkingBudget: string;
        thinkingIncludeThoughts: string;
        thinkingLevel: string;
        modelVolume: string;
        autoActivityDetection: string;
        manualVadMode: string;
        detectionSensitivity: string;
        silenceDurationMs: string;
        prefixPaddingMs: string;
        mediaResolution: string;
        frameIntervalMs: string;
        jpegQuality: string;
        changeThreshold: string;
        previewEnabled: string;
        proactiveMode: string;
        affectiveDialog: string;
        systemPrompt: string;
        proactivePolicy: string;
        maxAutonomousFrequencyMs: string;
        requiredSignificantFrames: string;
        commentaryDuringSilenceOnly: string;
        commentaryWhileIdleOnly: string;
        showLiveTimingPanel: string;
        verboseLogging: string;
      };
    };
    fields: {
      savedKey: string;
      noKeySaved: string;
      deleteKey: string;
      newKey: string;
      pasteApiKey: string;
      saveKey: string;
      model: string;
      apiVersionAuto: string;
      apiVersionHelp: string;
      voice: string;
      allowInterruption: string;
      allowInterruptionHelp: string;
      thinkingMode: string;
      thinkingModeHelp: string;
      thinkingBudget: string;
      thinkingBudgetHelp: string;
      thinkingIncludeThoughts: string;
      thinkingLevel: string;
      modelVolume: string;
      autoActivityDetection: string;
      manualVadMode: string;
      detectionSensitivity: string;
      silenceDurationMs: string;
      prefixPaddingMs: string;
      mediaResolution: string;
      frameIntervalMs: string;
      jpegQuality: string;
      changeThreshold: string;
      previewEnabled: string;
      proactiveMode: string;
      affectiveDialog: string;
      systemPrompt: string;
      proactivePolicy: string;
      maxAutonomousFrequencyMs: string;
      requiredSignificantFrames: string;
      requiredSignificantFramesHelp: string;
      commentaryDuringSilenceOnly: string;
      commentaryWhileIdleOnly: string;
      verboseLogging: string;
      exportPathHint: string;
      showLiveTimingPanel: string;
    };
    options: {
      mediaResolution: {
        low: string;
        medium: string;
        high: string;
      };
      proactiveMode: Record<ProactiveMode, string>;
      thinkingMode: {
        off: string;
        auto: string;
        custom: string;
      };
      thinkingLevel: {
        model_default: string;
        minimal: string;
        low: string;
        medium: string;
        high: string;
      };
    };
    voicePreview: {
      play: string;
      pause: string;
      loading: string;
    };
    saveSettings: string;
  };
}

export const translations: Record<Locale, TranslationDictionary> = {
  en: {
    app: {
      brand: "Gemini Live Desktop",
      brandEyebrow: "Professional",
      brandEdition: "AI Studio",
      navigation: {
        call: "Call",
        settings: "Settings",
        diagnostics: "Diagnostics"
      },
      language: {
        label: "Language",
        english: "English",
        russian: "Russian"
      }
    },
    common: {
      on: "On",
      off: "Off",
      defaultOption: "Default"
    },
    callPage: {
      heroTitle: "Gemini Live Desktop",
      heroSubtitle:
        "Voice, screen and camera routed through an isolated live worker with capability gating and diagnostics.",
      pageTitle: "Live Session",
      pageMeta: "Call",
      assistantModeTitle: "Assistant Mode",
      assistantModeDescription: "Live mode tuning stays visible on the call screen.",
      micLevel: "Mic level",
      manualTextTitle: "Manual Text",
      manualTextPlaceholder: "Send ordered client content",
      clearTranscript: "Clear Transcript",
      sendText: "Send Text",
      actionNames: {
        enableMicrophone: "enabling the microphone",
        shareScreen: "sharing the screen",
        startCamera: "starting the camera"
      },
      mediaSource: {
        microphone: "microphone",
        screen: "screen",
        camera: "camera"
      },
      modelHints: {
        meaningfulScreenChange:
          "Обнаружено существенное изменение на экране. Если это уместно, кратко прокомментируйте его."
      },
      messages: {
        connecting: "Connecting to Gemini Live...",
        connectFailed: "Connect failed",
        pausing: "Pausing session...",
        paused: "Session paused. Reconnect to continue the same chat.",
        connectedReady: "Connected. Live session is ready.",
        disconnecting: "Disconnecting...",
        disconnected: "Disconnected.",
        disconnectedReset:
          "Disconnected. Session reset complete. Next connect starts a new chat.",
        microphoneDisabled: "Microphone disabled.",
        microphoneEnabled: "Microphone enabled.",
        screenStopped: "Screen sharing stopped.",
        selectScreenFirst: "Select a screen or window source first.",
        screenEndedOutside: "Screen sharing ended outside the app.",
        screenStarted: "Screen sharing started.",
        cameraStopped: "Camera stopped.",
        cameraStarted: "Camera started.",
        microphoneStopped: "Microphone stopped",
        controlActionFailed: "Control action failed",
        voiceTelemetryFailed: "Failed to send voice turn telemetry",
        proactiveDecision: "Proactive orchestrator decision",
        audioTransportDetached: "Audio transport detached, requesting new media ports",
        visualTransportDetached: "Visual transport detached, requesting new media ports",
        microphoneStreamEnded: "Microphone stream ended",
        microphoneStreamEndedUnexpectedly: "Microphone stream ended unexpectedly",
        cannotStartScreenWithoutSource:
          "Cannot start screen capture without a selected source",
        screenRevoked: "Screen sharing was revoked or stopped outside the app",
        transportFailed: (sourceLabel, message) =>
          `${sourceLabel} transport failed: ${message}`,
        transportFailedShort: (sourceLabel) =>
          `${sourceLabel} transport failed`,
        mediaSessionRequired: (action) =>
          `Connect a live session before ${action}.`
      }
    },
    sessionControls: {
      statuses: {
        idle: "idle",
        connecting: "connecting",
        connected: "connected",
        reconnecting: "reconnecting",
        disconnecting: "disconnecting",
        disconnected: "disconnected",
        error: "error"
      },
      statusCopy: {
        connecting: "Trying to open a live session.",
        connected: "Live session is connected.",
        disconnecting: "Closing the live session.",
        reconnecting: "Connection dropped. Retrying automatically.",
        disconnected: "Session closed.",
        idle: "Ready to connect.",
        defaultError: "The last session action failed."
      },
      connect: "Connect",
      pause: "Pause",
      disconnect: "Disconnect",
      connecting: "Connecting...",
      pausing: "Pausing...",
      disconnecting: "Disconnecting...",
      mic: "Mic",
      cam: "Cam",
      screen: "Screen",
      stopPlayback: "Stop Playback"
    },
    proactiveMode: {
      title: "Proactive Mode",
      modes: {
        off: "off",
        pure: "pure",
        assisted: "assisted"
      },
      requestedApi: "Requested API",
      runtimeApi: "Runtime API",
      notConnectedYet: "not connected yet",
      errorPrefix: "Err:"
    },
    deviceSelectors: {
      title: "Devices",
      microphone: "Microphone",
      output: "Output",
      camera: "Camera",
      screenSource: "Screen Source",
      selectSource: "Select source",
      displayKind: {
        screen: "screen",
        window: "window"
      }
    },
    preview: {
      screen: "Screen Preview",
      camera: "Camera Preview"
    },
    transcript: {
      title: "Transcript",
      empty: "No transcript events yet.",
      speaker: {
        user: "User",
        model: "Model",
        system: "System"
      },
      status: {
        partial: "live",
        final: "final"
      }
    },
    diagnostics: {
      title: "Diagnostics",
      subtitle:
        "Compact support view for the last session state, key failures and raw event trail.",
      meta: "Support",
      exportLogs: "Export Logs",
      eventCountSuffix: "events",
      tableHeaders: {
        level: "Level",
        category: "Category",
        message: "Message",
        time: "Time"
      },
      summary: "Summary",
      latestStatus: "Latest Status",
      effectiveSessionSnapshot: "Effective Session Snapshot",
      eventTimeline: "Event Timeline",
      noDiagnosticsYet: "No diagnostics yet",
      noEffectiveConfigYet:
        "No connect attempt has produced an effective config yet.",
      summaryKeys: {
        totalEvents: "totalEvents",
        errorCount: "errorCount",
        warnCount: "warnCount",
        latestEvent: "latestEvent",
        category: "category",
        level: "level",
        message: "message",
        timestamp: "timestamp",
        details: "details"
      }
    },
    settings: {
      title: "Settings",
      subtitle: "One focused section at a time. No long scrolling setup screen.",
      meta: "Workspace",
      lockBanner:
        "Connect-time session options are locked while connected or paused with session continuation. Use Disconnect to apply new setup options. Realtime tuning stays available.",
      sections: {
        api: "API",
        audio: "Audio",
        visual: "Visual",
        behavior: "Behavior",
        diagnostics: "Diagnostics"
      },
      sectionDescriptions: {
        api: "Secure key storage, model selection and connect-time voice setup.",
        audio: "Playback level, activity detection and microphone turn segmentation.",
        visual: "Screen and camera frame quality, cadence and local preview behavior.",
        behavior: "Proactivity, affective dialog and system-level prompting behavior.",
        diagnostics: "Verbose logging and live timing panel for support workflows."
      },
      help: {
        iconAriaLabel: "Show setting description",
        sections: {
          api: "Secure key storage, model selection and connect-time voice setup.",
          audio: "Playback level, activity detection and microphone turn segmentation.",
          visual: "Screen and camera frame quality, cadence and local preview behavior.",
          behavior: "Proactivity, affective dialog and system-level prompting behavior.",
          diagnostics: "Verbose logging and live timing panel for support workflows."
        },
        fields: {
          savedKey:
            "Your API key is encrypted locally. The app can only show whether a key exists, not the full value.",
          model:
            "Selects which Gemini model will answer. Affects quality, speed, and feature support.",
          apiVersionAuto:
            "Set automatically. Switches to v1alpha when proactive mode or affective dialog requires it; otherwise uses v1beta.",
          voice:
            "Defines the model's speaking voice for audio replies. You can preview voices before connecting.",
          allowInterruption:
            "Lets you cut off the model by starting to speak. Turn off if you prefer uninterrupted full answers.",
          thinkingMode:
            "Controls extra reasoning before response: Off for lowest latency, Auto for model-chosen balance, Custom for manual control.",
          thinkingBudget:
            "Upper limit for reasoning tokens in Custom mode. Higher values can improve complex answers but increase latency and token usage.",
          thinkingIncludeThoughts:
            "Adds short reasoning summaries to the transcript when the model provides them.",
          thinkingLevel:
            "Hints how deep the model should think. Use higher levels for harder tasks and lower for faster replies.",
          modelVolume:
            "Playback volume of model audio in this app only. It does not change system volume.",
          autoActivityDetection:
            "Automatically detects when you start and stop speaking, so turns are sent without manual control.",
          manualVadMode:
            "Manual activity signaling mode. Kept for compatibility; this client currently turns it off on connect.",
          detectionSensitivity:
            "How easily speech is detected. Higher catches quiet speech sooner, but may trigger on background noise.",
          silenceDurationMs:
            "How long silence must last before your speech turn is considered finished.",
          prefixPaddingMs:
            "Keeps a short audio buffer before speech detection so first syllables are not clipped.",
          mediaResolution:
            "Resolution of camera/screen frames sent to the model. Higher improves detail but uses more CPU/network.",
          frameIntervalMs:
            "How often visual frames are sent. Lower values feel more live but increase load.",
          jpegQuality:
            "Image quality for visual frames. Higher quality gives clearer details but larger payloads.",
          changeThreshold:
            "Minimum visual change needed before a frame is treated as significant for proactive comments.",
          previewEnabled:
            "Shows local camera/screen preview tiles in the call dock. Turn off for a cleaner dock.",
          proactiveMode:
            "How proactive the assistant is: Off (reactive only), Pure (more autonomous), Assisted (more conservative).",
          affectiveDialog:
            "Makes voice responses sound more expressive and emotionally nuanced when supported by the selected model/API.",
          systemPrompt:
            "Base instruction that defines the assistant's default behavior and tone for each new connection.",
          proactivePolicy:
            "Extra rules for autonomous comments: what is allowed, what to avoid, and how often to speak.",
          maxAutonomousFrequencyMs:
            "Minimum pause between autonomous comments. Increase to reduce interruptions and chatter.",
          requiredSignificantFrames:
            "Number of consecutive significant visual changes required before autonomous commenting can start.",
          commentaryDuringSilenceOnly:
            "Allows autonomous comments only while you are silent, so it won't talk over your speech.",
          commentaryWhileIdleOnly:
            "Allows autonomous comments only when runtime signals mark you as idle.",
          showLiveTimingPanel:
            "Shows a per-turn latency panel on the Call page for quick performance checks.",
          verboseLogging:
            "Records more technical diagnostics for debugging and support exports."
        }
      },
      fields: {
        savedKey: "Saved key",
        noKeySaved: "No key saved",
        deleteKey: "Delete",
        newKey: "New key",
        pasteApiKey: "Paste Gemini API key",
        saveKey: "Save Key",
        model: "Model",
        apiVersionAuto: "API Version (auto)",
        apiVersionHelp:
          "Auto rule: v1alpha is used when Proactive Mode is not off or Affective Dialog is enabled.",
        voice: "Voice",
        allowInterruption: "Allow Interruption",
        allowInterruptionHelp:
          "When enabled, your speech can interrupt model playback. When disabled, model playback continues until it ends.",
        thinkingMode: "Thinking Mode",
        thinkingModeHelp:
          "Off disables reasoning. Auto lets the model decide. Custom lets you set a budget manually.",
        thinkingBudget: "Thinking Budget",
        thinkingBudgetHelp:
          "Custom mode budget range in this app: 128-8192 tokens. API model limits may vary.",
        thinkingIncludeThoughts: "Include Thought Summaries",
        thinkingLevel: "Thinking Level",
        modelVolume: "Model Volume",
        autoActivityDetection: "Auto Activity Detection",
        manualVadMode: "Manual VAD Mode",
        detectionSensitivity: "Detection Sensitivity",
        silenceDurationMs: "Silence Duration (ms)",
        prefixPaddingMs: "Prefix Padding (ms)",
        mediaResolution: "Media Resolution",
        frameIntervalMs: "Frame Interval (ms)",
        jpegQuality: "JPEG Quality",
        changeThreshold: "Change Threshold",
        previewEnabled: "Preview Enabled",
        proactiveMode: "Proactive Mode",
        affectiveDialog: "Affective Dialog",
        systemPrompt: "System Prompt",
        proactivePolicy: "Proactive Policy",
        maxAutonomousFrequencyMs: "Max Autonomous Frequency (ms)",
        requiredSignificantFrames: "Significant Frames Before Comment",
        requiredSignificantFramesHelp:
          "How many consecutive frames must exceed the change threshold before an autonomous comment is allowed.",
        commentaryDuringSilenceOnly: "Commentary During Silence Only",
        commentaryWhileIdleOnly: "Commentary While User Idle Only",
        verboseLogging: "Verbose Logging",
        exportPathHint: "Export Path Hint",
        showLiveTimingPanel: "Show Live Timing Panel"
      },
      options: {
        mediaResolution: {
          low: "Low",
          medium: "Medium",
          high: "High"
        },
        proactiveMode: {
          off: "Off",
          pure: "Pure",
          assisted: "Assisted"
        },
        thinkingMode: {
          off: "Off",
          auto: "Auto",
          custom: "Custom"
        },
        thinkingLevel: {
          model_default: "Model default",
          minimal: "Minimal",
          low: "Low",
          medium: "Medium",
          high: "High"
        }
      },
      voicePreview: {
        play: "Play",
        pause: "Pause",
        loading: "Loading..."
      },
      saveSettings: "Save Settings"
    }
  },
  ru: {
    app: {
      brand: "Gemini Live Desktop",
      brandEyebrow: "Профессиональный режим",
      brandEdition: "AI Studio",
      navigation: {
        call: "Звонок",
        settings: "Настройки",
        diagnostics: "Диагностика"
      },
      language: {
        label: "Язык",
        english: "English",
        russian: "Русский"
      }
    },
    common: {
      on: "Вкл",
      off: "Выкл",
      defaultOption: "По умолчанию"
    },
    callPage: {
      heroTitle: "Gemini Live Desktop",
      heroSubtitle:
        "Голос, экран и камера передаются через изолированный live-воркер с проверкой возможностей и диагностикой.",
      pageTitle: "Лайв-сессия",
      pageMeta: "Звонок",
      assistantModeTitle: "Режим ассистента",
      assistantModeDescription: "Настройки live-режима доступны прямо на экране звонка.",
      micLevel: "Уровень микрофона",
      manualTextTitle: "Ручной текст",
      manualTextPlaceholder: "Отправить упорядоченный клиентский контент",
      clearTranscript: "Очистить транскрипт",
      sendText: "Отправить текст",
      actionNames: {
        enableMicrophone: "включением микрофона",
        shareScreen: "демонстрацией экрана",
        startCamera: "запуском камеры"
      },
      mediaSource: {
        microphone: "микрофон",
        screen: "экран",
        camera: "камера"
      },
      modelHints: {
        meaningfulScreenChange:
          "A meaningful screen change was detected. If it is helpful, comment briefly on the change."
      },
      messages: {
        connecting: "Подключение к Gemini Live...",
        connectFailed: "Не удалось подключиться",
        pausing: "Пауза сессии...",
        paused: "Сессия на паузе. Подключитесь снова, чтобы продолжить этот чат.",
        connectedReady: "Подключено. Live-сессия готова.",
        disconnecting: "Отключение...",
        disconnected: "Отключено.",
        disconnectedReset:
          "Отключено. Сессия полностью сброшена. Следующее подключение создаст новый чат.",
        microphoneDisabled: "Микрофон выключен.",
        microphoneEnabled: "Микрофон включён.",
        screenStopped: "Демонстрация экрана остановлена.",
        selectScreenFirst: "Сначала выберите источник экрана или окна.",
        screenEndedOutside: "Демонстрация экрана завершена вне приложения.",
        screenStarted: "Демонстрация экрана запущена.",
        cameraStopped: "Камера остановлена.",
        cameraStarted: "Камера запущена.",
        microphoneStopped: "Микрофон остановлен",
        controlActionFailed: "Ошибка действия управления",
        voiceTelemetryFailed: "Не удалось отправить телеметрию голосового хода",
        proactiveDecision: "Решение проактивного оркестратора",
        audioTransportDetached:
          "Аудиоканал транспорта отсоединён, запрашиваем новые медиа-порты",
        visualTransportDetached:
          "Видеоканал транспорта отсоединён, запрашиваем новые медиа-порты",
        microphoneStreamEnded: "Поток микрофона завершился",
        microphoneStreamEndedUnexpectedly:
          "Поток микрофона неожиданно завершился",
        cannotStartScreenWithoutSource:
          "Невозможно запустить захват экрана без выбранного источника",
        screenRevoked: "Демонстрация экрана отозвана или остановлена вне приложения",
        transportFailed: (sourceLabel, message) =>
          `Сбой передачи (${sourceLabel}): ${message}`,
        transportFailedShort: (sourceLabel) =>
          `Сбой передачи (${sourceLabel})`,
        mediaSessionRequired: (action) =>
          `Сначала подключите live-сессию перед ${action}.`
      }
    },
    sessionControls: {
      statuses: {
        idle: "ожидание",
        connecting: "подключение",
        connected: "подключено",
        reconnecting: "переподключение",
        disconnecting: "отключение",
        disconnected: "отключено",
        error: "ошибка"
      },
      statusCopy: {
        connecting: "Пытаемся открыть live-сессию.",
        connected: "Live-сессия подключена.",
        disconnecting: "Закрываем live-сессию.",
        reconnecting: "Соединение потеряно. Автоматическая повторная попытка.",
        disconnected: "Сессия закрыта.",
        idle: "Готово к подключению.",
        defaultError: "Последнее действие сессии завершилось ошибкой."
      },
      connect: "Подключить",
      pause: "Пауза",
      disconnect: "Отключить",
      connecting: "Подключение...",
      pausing: "Пауза...",
      disconnecting: "Отключение...",
      mic: "Мик",
      cam: "Кам",
      screen: "Экран",
      stopPlayback: "Остановить воспроизведение"
    },
    proactiveMode: {
      title: "Проактивный режим",
      modes: {
        off: "выкл",
        pure: "чистый",
        assisted: "с поддержкой"
      },
      requestedApi: "Запрошенный API",
      runtimeApi: "Фактический API",
      notConnectedYet: "ещё не подключено",
      errorPrefix: "Ошибка:"
    },
    deviceSelectors: {
      title: "Устройства",
      microphone: "Микрофон",
      output: "Вывод",
      camera: "Камера",
      screenSource: "Источник экрана",
      selectSource: "Выберите источник",
      displayKind: {
        screen: "экран",
        window: "окно"
      }
    },
    preview: {
      screen: "Предпросмотр экрана",
      camera: "Предпросмотр камеры"
    },
    transcript: {
      title: "Транскрипт",
      empty: "Транскрипция пока пуста.",
      speaker: {
        user: "Пользователь",
        model: "Модель",
        system: "Система"
      },
      status: {
        partial: "live",
        final: "финал"
      }
    },
    diagnostics: {
      title: "Диагностика",
      subtitle:
        "Компактный экран поддержки: последнее состояние сессии, ключевые сбои и лента сырых событий.",
      meta: "Поддержка",
      exportLogs: "Экспорт логов",
      eventCountSuffix: "событий",
      tableHeaders: {
        level: "Уровень",
        category: "Категория",
        message: "Сообщение",
        time: "Время"
      },
      summary: "Сводка",
      latestStatus: "Последний статус",
      effectiveSessionSnapshot: "Эффективный снимок сессии",
      eventTimeline: "Лента событий",
      noDiagnosticsYet: "Диагностика пока отсутствует",
      noEffectiveConfigYet:
        "Ни одна попытка подключения ещё не сформировала эффективную конфигурацию.",
      summaryKeys: {
        totalEvents: "всегоСобытий",
        errorCount: "ошибок",
        warnCount: "предупреждений",
        latestEvent: "последнееСобытие",
        category: "категория",
        level: "уровень",
        message: "сообщение",
        timestamp: "время",
        details: "детали"
      }
    },
    settings: {
      title: "Настройки",
      subtitle:
        "Один сфокусированный раздел за раз. Без длинного экрана с прокруткой.",
      meta: "Рабочее пространство",
      lockBanner:
        "Параметры подключения заблокированы во время активной сессии и после паузы с сохранённым продолжением. Чтобы применить новые параметры подключения, используйте Отключить. Realtime-настройки остаются доступны.",
      sections: {
        api: "API",
        audio: "Аудио",
        visual: "Видео",
        behavior: "Поведение",
        diagnostics: "Диагностика"
      },
      sectionDescriptions: {
        api: "Безопасное хранение ключа, выбор модели и голоса на этапе подключения.",
        audio: "Громкость воспроизведения, детекция активности и сегментация голосовых ходов микрофона.",
        visual:
          "Качество кадров экрана и камеры, частота и локальный предпросмотр.",
        behavior:
          "Проактивность, аффективный диалог и поведение системного промпта.",
        diagnostics:
          "Подробное логирование и панель задержек для поддержки."
      },
      help: {
        iconAriaLabel: "Показать описание параметра",
        sections: {
          api: "Безопасное хранение ключа, выбор модели и голоса на этапе подключения.",
          audio: "Громкость, детекция активности и сегментация голосовых ходов микрофона.",
          visual: "Качество кадров экрана/камеры, частота отправки и локальный предпросмотр.",
          behavior: "Проактивность, аффективный диалог и поведение системного промпта.",
          diagnostics: "Подробное логирование и панель задержек для отладки."
        },
        fields: {
          savedKey:
            "API-ключ хранится локально в зашифрованном виде. Приложение показывает только факт наличия ключа, без полного значения.",
          model:
            "Выбирает модель Gemini, которая будет отвечать. Влияет на качество, скорость и доступные возможности.",
          apiVersionAuto:
            "Выбирается автоматически: v1alpha включается, когда нужен проактивный режим или аффективный диалог, иначе используется v1beta.",
          voice:
            "Определяет голос озвучки ответов модели. Голоса можно прослушать до подключения.",
          allowInterruption:
            "Позволяет перебить ответ модели началом вашей речи. Выключите, если хотите, чтобы модель всегда договаривала до конца.",
          thinkingMode:
            "Управляет дополнительным размышлением перед ответом: Off — минимальная задержка, Auto — баланс от модели, Custom — ручная настройка.",
          thinkingBudget:
            "Лимит токенов размышления в режиме Custom. Большее значение может улучшить сложные ответы, но увеличивает задержку и расход токенов.",
          thinkingIncludeThoughts:
            "Добавляет в транскрипт краткое резюме рассуждений, если модель его возвращает.",
          thinkingLevel:
            "Подсказывает глубину размышления модели. Более высокий уровень — точнее на сложных задачах, но обычно медленнее.",
          modelVolume:
            "Громкость воспроизведения голоса модели только в этом приложении. Системную громкость не меняет.",
          autoActivityDetection:
            "Автоматически определяет начало и конец вашей речи, чтобы ходы микрофона отправлялись без ручного управления.",
          manualVadMode:
            "Режим ручной сигнализации активности. Оставлен для совместимости; в текущем клиенте при connect отключается.",
          detectionSensitivity:
            "Насколько легко детектируется речь. Выше — лучше ловит тихий голос, но чаще реагирует на фоновые шумы.",
          silenceDurationMs:
            "Как долго должна длиться тишина, чтобы речевой ход считался завершённым.",
          prefixPaddingMs:
            "Сохраняет небольшой аудио-буфер до начала речи, чтобы не обрезались первые слоги.",
          mediaResolution:
            "Разрешение кадров камеры и экрана, отправляемых модели. Выше — лучше детализация, но больше нагрузка.",
          frameIntervalMs:
            "Как часто отправляются визуальные кадры. Меньше значение — более живое обновление, но выше нагрузка.",
          jpegQuality:
            "Качество сжатия JPEG для визуальных кадров. Выше качество — четче картинка, но больше трафик.",
          changeThreshold:
            "Минимальный уровень изменения кадра, после которого оно считается значимым для проактивных комментариев.",
          previewEnabled:
            "Показывает локальные превью камеры и экрана в доке звонка. Можно выключить для более чистого интерфейса.",
          proactiveMode:
            "Насколько инициативно ведёт себя ассистент: Off — только по запросу, Pure — более автономно, Assisted — осторожнее.",
          affectiveDialog:
            "Делает голосовые ответы более живыми и эмоционально выразительными, если это поддерживает выбранная модель/API.",
          systemPrompt:
            "Базовая инструкция, которая задаёт стиль и поведение ассистента при каждом новом подключении.",
          proactivePolicy:
            "Дополнительные правила для автономных комментариев: что разрешено, что избегать и как часто вмешиваться.",
          maxAutonomousFrequencyMs:
            "Минимальная пауза между автономными комментариями. Увеличьте значение, чтобы снизить навязчивость.",
          requiredSignificantFrames:
            "Сколько значимых изменений подряд должно появиться на экране, прежде чем разрешён автономный комментарий.",
          commentaryDuringSilenceOnly:
            "Разрешает автономные комментарии только во время вашей тишины, чтобы не перебивать речь.",
          commentaryWhileIdleOnly:
            "Разрешает автономные комментарии только когда система считает пользователя неактивным.",
          showLiveTimingPanel:
            "Показывает на странице Call панель задержек по этапам каждого хода.",
          verboseLogging:
            "Добавляет расширенные технические события в диагностику для отладки и экспорта."
        }
      },
      fields: {
        savedKey: "Сохранённый ключ",
        noKeySaved: "Ключ не сохранён",
        deleteKey: "Удалить",
        newKey: "Новый ключ",
        pasteApiKey: "Вставьте Gemini API key",
        saveKey: "Сохранить ключ",
        model: "Модель",
        apiVersionAuto: "Версия API (авто)",
        apiVersionHelp:
          "Автоправило: используется v1alpha, если проактивный режим не выключен или включён аффективный диалог.",
        voice: "Голос",
        allowInterruption: "Разрешить перебивание",
        allowInterruptionHelp:
          "Если включено, начало вашей речи может прервать ответ модели. Если выключено, модель договаривает ответ до конца.",
        thinkingMode: "Режим размышления",
        thinkingModeHelp:
          "Выкл отключает размышление. Авто отдаёт выбор модели. Custom позволяет задать бюджет вручную.",
        thinkingBudget: "Бюджет размышления",
        thinkingBudgetHelp:
          "Для режима Custom в приложении доступно 128-8192 токенов. Фактические лимиты зависят от модели API.",
        thinkingIncludeThoughts: "Показывать резюме размышлений",
        thinkingLevel: "Уровень размышления",
        modelVolume: "Громкость модели",
        autoActivityDetection: "Автоопределение активности",
        manualVadMode: "Ручной режим VAD",
        detectionSensitivity: "Чувствительность детекции",
        silenceDurationMs: "Длительность тишины (мс)",
        prefixPaddingMs: "Префиксный буфер (мс)",
        mediaResolution: "Разрешение медиа",
        frameIntervalMs: "Интервал кадров (мс)",
        jpegQuality: "Качество JPEG",
        changeThreshold: "Порог изменений",
        previewEnabled: "Включить предпросмотр",
        proactiveMode: "Проактивный режим",
        affectiveDialog: "Аффективный диалог",
        systemPrompt: "Системный промпт",
        proactivePolicy: "Политика проактивных комментариев",
        maxAutonomousFrequencyMs: "Макс. частота автономных комментариев (мс)",
        requiredSignificantFrames: "Значимых кадров до комментария",
        requiredSignificantFramesHelp:
          "Сколько последовательных кадров должны превысить порог изменений, прежде чем разрешён автономный комментарий.",
        commentaryDuringSilenceOnly: "Комментарии только во время тишины",
        commentaryWhileIdleOnly: "Комментарии только при неактивности пользователя",
        verboseLogging: "Подробное логирование",
        exportPathHint: "Подсказка пути экспорта",
        showLiveTimingPanel: "Показывать панель задержек в звонке"
      },
      options: {
        mediaResolution: {
          low: "Низкое",
          medium: "Среднее",
          high: "Высокое"
        },
        proactiveMode: {
          off: "Выкл",
          pure: "Чистый",
          assisted: "С поддержкой"
        },
        thinkingMode: {
          off: "Выкл",
          auto: "Авто",
          custom: "Свой"
        },
        thinkingLevel: {
          model_default: "По умолчанию модели",
          minimal: "Минимальный",
          low: "Низкий",
          medium: "Средний",
          high: "Высокий"
        }
      },
      voicePreview: {
        play: "Слушать",
        pause: "Пауза",
        loading: "Загрузка..."
      },
      saveSettings: "Сохранить настройки"
    }
  }
};
