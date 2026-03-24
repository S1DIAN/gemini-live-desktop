import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  children,
  mainClassName
}: {
  sidebar: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="app-shell">
      {sidebar}
      <main className={mainClassName ? `app-main ${mainClassName}` : "app-main"}>
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  );
}
