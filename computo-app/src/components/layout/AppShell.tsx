"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  /** Si el Sidebar queda fijo como columna en desktop (lg+) o si se
   * comporta como drawer también ahí (siempre oculto salvo que se abra
   * — pero en desktop no hay hamburguesa para abrirlo, ver
   * Header.tsx). /inicio la usa en false: es una landing centrada sin
   * nav docked, pero igual necesita el drawer para navegar desde
   * mobile — ver Sidebar.tsx (dockedOnDesktop). Default true: no
   * cambia nada para el resto de las páginas. */
  dockSidebarOnDesktop?: boolean;
}

export function AppShell({ children, showSidebar = true, dockSidebarOnDesktop = true }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <Header
        showMenuButton={showSidebar}
        onMenuClick={() => setMobileSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
            dockedOnDesktop={dockSidebarOnDesktop}
          />
        )}
        <main className="flex-1 overflow-y-auto bg-bg-base overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
