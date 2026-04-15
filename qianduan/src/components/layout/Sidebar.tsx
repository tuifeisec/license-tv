import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { navigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const items = navigationForRole(user?.role);

  return (
    <div className="flex h-full flex-col bg-sidebar-background text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className={cn("min-w-0", collapsed ? "hidden" : "block")}>
            <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">TradingView</p>
            <p className="truncate text-sm font-semibold">权限控制台</p>
          </div>

          {onToggle ? (
            <Button variant="ghost" size="xs" onClick={onToggle} className="shrink-0">
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className={cn("mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", collapsed && "hidden")}>
          导航
        </p>

        <nav className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80",
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
