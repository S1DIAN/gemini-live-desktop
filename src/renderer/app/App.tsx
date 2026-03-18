import { useEffect } from "react";
import { AppRoutes } from "./routes";
import { useSettingsStore } from "@renderer/state/settingsStore";
import { useDiagnosticsStore } from "@renderer/state/diagnosticsStore";
import { liveClientAdapter } from "@renderer/services/live/liveClientAdapter";

export function App() {
  const loadSettings = useSettingsStore((state) => state.load);
  const loadDiagnostics = useDiagnosticsStore((state) => state.loadInitial);

  useEffect(() => {
    liveClientAdapter.initialize();
    void loadSettings();
    void loadDiagnostics();
    return () => liveClientAdapter.dispose();
  }, [loadDiagnostics, loadSettings]);

  return <AppRoutes />;
}
