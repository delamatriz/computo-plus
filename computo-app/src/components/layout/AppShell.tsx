"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function AppShell({ children, showSidebar = true }: AppShellProps) {
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
          />
        )}
        <main className="flex-1 overflow-y-auto bg-bg-base overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
