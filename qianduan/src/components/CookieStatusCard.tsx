import { ShieldCheck, ShieldX } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyRow } from "@/components/PropertyRow";
import type { TVSessionStatus } from "@/types/api";

export function CookieStatusCard({ data }: { data: TVSessionStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>TV Session 状态</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3">
          {data.valid ? <ShieldCheck className="size-5 text-success" /> : <ShieldX className="size-5 text-destructive" />}
          <div>
            <p className="text-sm font-medium">{data.valid ? "连接正常" : "连接异常"}</p>
            <p className="text-xs text-muted-foreground">{data.error ?? "Cookie 已通过校验。"}</p>
          </div>
        </div>
        <div className="space-y-1">
          <PropertyRow label="已配置" value={data.status.configured ? "是" : "否"} />
          <PropertyRow label="SessionID" value={data.status.sessionid_masked ?? "未配置"} />
          <PropertyRow label="Session Sign" value={data.status.sessionid_sign_masked ?? "未配置"} />
          <PropertyRow label="TV 账号" value={data.account?.username ?? "未识别"} />
        </div>
      </CardContent>
    </Card>
  );
}
