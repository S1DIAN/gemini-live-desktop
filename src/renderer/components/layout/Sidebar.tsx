import { NavLink } from "react-router-dom";
import { useI18n } from "@renderer/i18n/useI18n";
import {
  ActivityIcon,
  PhoneIcon,
  SettingsIcon
} from "@renderer/components/ui/Icons";
export function Sidebar() {
  const { locale, setLocale, copy } = useI18n();

  const navItems = [
    { to: "/", label: copy.app.navigation.call, icon: <PhoneIcon /> },
    { to: "/settings", label: copy.app.navigation.settings, icon: <SettingsIcon /> },
    { to: "/diagnostics", label: copy.app.navigation.diagnostics, icon: <ActivityIcon /> }
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand-block">
        <div className="sidebar-eyebrow">Workspace</div>
        <div className="sidebar-brand">{copy.app.brand}</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"}>
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-title">{copy.app.language.label}</div>
        <div className="locale-switch">
          <button
            type="button"
            className={locale === "en" ? "active" : ""}
            onClick={() => setLocale("en")}
          >
            {copy.app.language.english}
          </button>
          <button
            type="button"
            className={locale === "ru" ? "active" : ""}
            onClick={() => setLocale("ru")}
          >
            {copy.app.language.russian}
          </button>
        </div>
      </div>
    </aside>
  );
}
