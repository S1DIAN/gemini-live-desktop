import { HashRouter, Route, Routes } from "react-router-dom";
import { CallPage } from "@renderer/pages/CallPage";
import { SettingsPage } from "@renderer/pages/SettingsPage";
import { DiagnosticsPage } from "@renderer/pages/DiagnosticsPage";
import { AppShell } from "@renderer/components/layout/AppShell";
import { Sidebar } from "@renderer/components/layout/Sidebar";

export function AppRoutes() {
  return (
    <HashRouter>
      <AppShell sidebar={<Sidebar />}>
        <div className="page-shell">
          <Routes>
            <Route path="/" element={<CallPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
          </Routes>
        </div>
      </AppShell>
    </HashRouter>
  );
}
