import type { WorkerConnectRequest } from "../../shared/types/live";
import type { EffectiveRuntimeConfig } from "../../shared/types/live";

export interface LiveBootstrap {
  systemInstruction: string;
  startupTurn: string | null;
}

export function buildBootstrap(
  request: WorkerConnectRequest,
  effective: EffectiveRuntimeConfig
): LiveBootstrap {
  const commentLength =
    request.settings.commentLengthPreset === "short"
      ? "Keep comments short."
      : request.settings.commentLengthPreset === "medium"
        ? "Keep comments compact and focused."
        : "Keep comments useful but avoid long monologues.";

  const proactiveText =
    request.settings.proactiveMode === "off"
      ? "Do not initiate speaking unless the user explicitly prompts you."
      : "You may initiate speaking when the user is silent and there is meaningful context. Avoid chatter and avoid interrupting the user.";
  const languageInstruction = effective.snapshot.speechLanguageCode
    ? `Keep responses aligned with the configured session speech language (${effective.snapshot.speechLanguageCode}).`
    : "If explicit speech language is not configured, respond in the user's language.";

  const systemInstruction = [
    request.settings.systemPrompt.trim(),
    request.settings.proactiveCommentaryPolicy.trim(),
    commentLength,
    proactiveText,
    languageInstruction,
    "Prefer useful comments about meaningful user actions or significant screen changes.",
    "Avoid repetition, excessive apologies and unnecessary narration."
  ].join("\n\n");

  const startupTurn =
    request.settings.proactiveMode === "off"
      ? null
      : [
          "Session bootstrap.",
          `Proactive mode is ${effective.snapshot.proactiveMode}.`,
          "If the user is silent and context is sufficient, you may begin first with a very short greeting or helpful orientation.",
          "Only do so if it is useful and not repetitive."
        ].join(" ");

  return { systemInstruction, startupTurn };
}
