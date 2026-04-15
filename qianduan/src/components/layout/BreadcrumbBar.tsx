import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { Button } from "@/components/ui/button";
import { homePathForRole, pageTitleFor } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";

const segmentMap: Record<string, { label: string; href?: string }> = {
  dashboard: { label: "总览看板" },
  scripts: { label: "脚本管理" },
  reviews: { label: "审核中心" },
  subscriptions: { label: "订阅管理" },
  customers: { label: "客户台账" },
  "sub-admins": { label: "管理员" },
  agents: { label: "代理管理" },
  settings: { label: "系统设置" },
  profile: { label: "个人中心" },
  agent: { label: "代理工作", href: "/agent/dashboard" },
  requests: { label: "申请记录" },
  "design-guide": { label: "设计规范" },
  "tv-access": { label: "授权总表" },
  "tv-register": { label: "注册 TradingView" },
};

export function BreadcrumbBar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const homePath = homePathForRole(user?.role);

  const crumbs = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      href: segmentMap[segment]?.href ?? `/${segments.slice(0, index + 1).join("/")}`,
      label: segmentMap[segment]?.label ?? segment,
    }));
  }, [location.pathname]);

  return (
    <div className="sticky top-0 z-30 border-b border-border/70 bg-background/84 backdrop-blur-md">
      <div className="flex min-h-16 items-center gap-4 px-4 py-3 lg:px-6">
        {onOpenMobileNav ? (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="打开侧边导航">
            <Menu className="size-5" />
          </Button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link to={homePath} className="transition-colors hover:text-foreground">
              控制台
            </Link>
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.href}-${index}`} className="inline-flex items-center gap-1">
                <ChevronRight className="size-3" />
                <Link to={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              </span>
            ))}
          </div>

          <p className="truncate text-xl font-bold tracking-tight">{pageTitleFor(location.pathname)}</p>
        </div>

        <div className="shrink-0">
          <AccountMenu />
        </div>
      </div>
    </div>
  );
}
