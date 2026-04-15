import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { homePathForRole } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";

export function NotFoundPage() {
  const user = useAuthStore((state) => state.user);
  const fallbackPath = user ? homePathForRole(user.role) : "/login";
  const fallbackLabel = user ? "返回控制台" : "返回登录页";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 py-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground">
            <SearchX className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">页面不存在</h1>
            <p className="text-sm text-muted-foreground">目标页面可能已被移除，或者当前地址输入有误。</p>
          </div>
          <Link to={fallbackPath}>
            <Button>{fallbackLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
