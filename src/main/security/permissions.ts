import { desktopCapturer, session } from "electron";
import type { DiagnosticsEvent } from "../../shared/types/diagnostics";
import type { DisplaySourceDescriptor } from "../../shared/types/ipc";

export class DisplayMediaPermissions {
  private armedSourceId: string | null = null;

  constructor(
    private readonly emitDiagnostics: (event: DiagnosticsEvent) => void
  ) {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        const selectedSourceId = this.armedSourceId;
        this.armedSourceId = null;

        if (!selectedSourceId) {
          this.emitDiagnostics(this.event("warn", "No armed display source"));
          callback({} as never);
          return;
        }

        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 320, height: 180 }
        });
        const selected = sources.find((source) => source.id === selectedSourceId);

        if (!selected) {
          this.emitDiagnostics(
            this.event("warn", "Armed display source no longer exists", {
              sourceId: selectedSourceId
            })
          );
          callback({} as never);
          return;
        }

        this.emitDiagnostics(
          this.event("info", "Display source granted", { sourceId: selected.id })
        );
        callback({ video: selected });
      },
      { useSystemPicker: false }
    );
  }

  async listSources(): Promise<DisplaySourceDescriptor[]> {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 }
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnailDataUrl: source.thumbnail.toDataURL()
    }));
  }

  armCapture(sourceId: string): void {
    this.armedSourceId = sourceId;
    this.emitDiagnostics(
      this.event("info", "Display source armed for next getDisplayMedia call", {
        sourceId
      })
    );
  }

  private event(
    level: DiagnosticsEvent["level"],
    message: string,
    details?: Record<string, unknown>
  ): DiagnosticsEvent {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      category: "media",
      message,
      details
    };
  }
}
