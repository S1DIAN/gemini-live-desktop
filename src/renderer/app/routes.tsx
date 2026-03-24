import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { CallPage } from "@renderer/pages/CallPage";
import { SettingsPage } from "@renderer/pages/SettingsPage";
import { DiagnosticsPage } from "@renderer/pages/DiagnosticsPage";
import { AppShell } from "@renderer/components/layout/AppShell";
import { Sidebar } from "@renderer/components/layout/Sidebar";

export function AppRoutes() {
  return (
    <HashRouter>
      <RoutedShell />
    </HashRouter>
  );
}

function RoutedShell() {
  const location = useLocation();
  const isCallRoute = location.pathname === "/";

  return (
    <AppShell
      sidebar={<Sidebar />}
      mainClassName={isCallRoute ? "app-main-call-route" : undefined}
    >
      <div className={`page-shell${isCallRoute ? " page-shell-call-route" : ""}`}>
        <Routes>
          <Route path="/" element={<CallPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
        </Routes>
      </div>
    </AppShell>
  );
}
