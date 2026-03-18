import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { CallPage } from "@renderer/pages/CallPage";
import { SettingsPage } from "@renderer/pages/SettingsPage";
import { DiagnosticsPage } from "@renderer/pages/DiagnosticsPage";
import { useI18n } from "@renderer/i18n/useI18n";
import type { Locale } from "@renderer/i18n/translations";

export function AppRoutes() {
  const { locale, setLocale, copy } = useI18n();

  const handleLocaleChange = (nextLocale: Locale) => {
    setLocale(nextLocale);
  };

  return (
    <HashRouter>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">{copy.app.brand}</div>
          <nav>
            <NavLink to="/">{copy.app.navigation.call}</NavLink>
            <NavLink to="/settings">{copy.app.navigation.settings}</NavLink>
            <NavLink to="/diagnostics">{copy.app.navigation.diagnostics}</NavLink>
          </nav>
          <div className="locale-switch">
            <div className="locale-label">{copy.app.language.label}</div>
            <div className="locale-buttons">
              <button
                className={locale === "en" ? "active" : ""}
                onClick={() => handleLocaleChange("en")}
              >
                {copy.app.language.english}
              </button>
              <button
                className={locale === "ru" ? "active" : ""}
                onClick={() => handleLocaleChange("ru")}
              >
                {copy.app.language.russian}
              </button>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<CallPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
