import { useState } from "react";
import { Outlet } from "react-router-dom";

import { BreadcrumbBar } from "@/components/layout/BreadcrumbBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <aside
        className={cn(
          "hidden border-r border-sidebar-border bg-sidebar-background transition-all duration-200 lg:sticky lg:top-0 lg:block lg:h-screen lg:shrink-0",
          collapsed ? "w-[5.5rem]" : "w-60",
        )}
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            className="flex-1 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭侧栏遮罩"
          />
          <aside className="w-72 border-l border-sidebar-border bg-sidebar-background">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
        <BreadcrumbBar onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main-content" className="px-4 py-4 lg:flex-1 lg:overflow-y-auto lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
