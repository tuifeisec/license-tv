import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { logoutAgent } from "@/api/agent/auth";
import { logoutAdmin } from "@/api/auth";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

function roleLabel(role?: string | null) {
  switch (role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "sub_admin":
      return "管理员";
    case "agent":
      return "代理账户";
    default:
      return "访客";
  }
}

export function AccountMenu() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const authScope = useAuthStore((state) => state.authScope);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const displayName = user.display_name?.trim() || user.username;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-card/70 pl-2 pr-2.5 text-left shadow-sm transition-colors hover:bg-accent/55 ring-focus",
          open && "bg-accent/65 text-accent-foreground",
        )}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-accent/70 text-xs font-semibold text-accent-foreground">
          {initials(displayName)}
        </div>

        <div className="hidden min-w-0 md:block">
          <span className="block max-w-32 truncate text-sm font-medium">{displayName}</span>
        </div>

        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-foreground")}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-border/80 bg-popover/95 p-1.5 shadow-sm backdrop-blur-md"
        >
          <div className="flex items-center gap-3 rounded-md px-2.5 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-accent text-sm font-semibold text-accent-foreground">
              {initials(displayName)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{user.username}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="text-xs text-muted-foreground">当前身份</span>
            <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px] tracking-[0.12em] text-muted-foreground">
              {roleLabel(user.role)}
            </Badge>
          </div>

          <div className="mb-1 border-t border-border/70" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 ring-focus"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">个人中心</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">查看资料、修改密码与安全设置</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 ring-focus"
            onClick={async () => {
              setOpen(false);
              try {
                if (authScope === "agent") {
                  await logoutAgent();
                } else if (authScope === "admin") {
                  await logoutAdmin();
                }
              } catch {
                // Clear local session even when logout request cannot reach the server.
              }
              clearSession();
              navigate("/login");
            }}
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground">
              <LogOut className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">退出登录</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">结束当前会话并返回登录页</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
