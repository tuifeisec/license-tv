import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { homePathForRole } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";

export function ForbiddenPage() {
  const role = useAuthStore((state) => state.user?.role);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 py-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
            <ShieldAlert className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">403 无权访问</h1>
            <p className="text-sm text-muted-foreground">当前账号没有访问这个页面的权限，请回到你的工作台继续操作。</p>
          </div>
          <Button onClick={() => (window.location.href = homePathForRole(role))}>
            返回首页
          </Button>
          <div className="text-xs text-muted-foreground">
            或者前往 <Link to="/login" className="text-primary hover:underline">登录页</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
