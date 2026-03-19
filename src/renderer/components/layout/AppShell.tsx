import type { ReactNode } from "react";
import { LocaleDock } from "@renderer/components/layout/LocaleDock";

export function AppShell({
  sidebar,
  children
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      {sidebar}
      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
      <LocaleDock />
    </div>
  );
}
