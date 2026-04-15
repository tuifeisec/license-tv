import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getSubscription, renewSubscription, revokeSubscription } from "@/api/subscriptions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { StatusBadge } from "@/components/StatusBadge";
import { SubscriptionRenewDialog } from "@/components/SubscriptionRenewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { PlanType } from "@/types/api";

export function SubscriptionDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [renewOpen, setRenewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const query = useQuery({
    queryKey: ["subscription", id],
    queryFn: () => getSubscription(id),
  });

  const renewMutation = useMutation({
    mutationFn: (payload: { plan_type: PlanType; requested_days?: number }) => renewSubscription(id, payload),
    onSuccess: () => {
      notify({ title: "订阅续费已生效", tone: "success" });
      setRenewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: () => revokeSubscription(id),
    onSuccess: () => {
      notify({ title: "授权已撤销", tone: "warning" });
      setRevokeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const item = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`订阅详情 · #${item.id}`}
        description="管理员可以直接管理单条订阅，并把变更同步到 TradingView 授权。"
        actions={
          item.status === "active" ? (
            <>
              <Button variant="outline" onClick={() => setRenewOpen(true)}>
                续费
              </Button>
              <Button variant="destructive" onClick={() => setRevokeOpen(true)}>
                撤销授权
              </Button>
            </>
          ) : (
            <Badge variant="outline">{item.status === "expired" ? "该订阅已过期" : "该订阅已撤销授权"}</Badge>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>订阅信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PropertyRow label="状态" value={<StatusBadge status={item.status} />} />
            <PropertyRow label="套餐" value={<PlanTypeBadge value={item.plan_type} />} />
            <PropertyRow label="TV 已授权" value={item.tv_granted ? "是" : "否"} />
            <PropertyRow label="开始时间" value={formatDateTime(item.started_at)} />
            <PropertyRow label="到期时间" value={formatDateTime(item.expires_at)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>客户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PropertyRow label="TV 用户名" value={item.customer?.tv_username ?? "—"} />
            <PropertyRow label="联系方式" value={item.customer?.contact ?? "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>脚本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PropertyRow label="脚本名称" value={item.script?.name ?? "—"} />
            <PropertyRow label="版本" value={item.script?.version ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <SubscriptionRenewDialog
        open={renewOpen}
        subscription={item}
        onClose={() => setRenewOpen(false)}
        pending={renewMutation.isPending}
        onSubmit={(payload) => renewMutation.mutate(payload)}
      />
      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={() => revokeMutation.mutate()}
        pending={revokeMutation.isPending}
        title="确认撤销授权"
        description="撤销后会移除该客户在 TradingView 的脚本访问权限，但订阅记录仍会保留用于审计。"
        confirmText="确认撤销授权"
      />
    </div>
  );
}
