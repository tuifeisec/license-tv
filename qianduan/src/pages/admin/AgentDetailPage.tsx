import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, KeyRound, ShieldUser, Users } from "lucide-react";
import { useParams } from "react-router-dom";

import { getAgent, resetAgentPassword } from "@/api/agents";
import { AgentPasswordResetDialog } from "@/components/AgentPasswordResetDialog";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PropertyRow } from "@/components/PropertyRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";

export function AgentDetailPage() {
  const { id = "" } = useParams();
  const [resetOpen, setResetOpen] = useState(false);

  const query = useQuery({
    queryKey: ["agent", id],
    queryFn: () => getAgent(id),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => resetAgentPassword(id, { new_password: newPassword }),
    onSuccess: () => {
      notify({ title: "代理密码已重置", tone: "success" });
      setResetOpen(false);
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const item = query.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`代理详情 / ${item.display_name || item.username}`}
        actions={
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <KeyRound className="size-4" />
            重置密码
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon={Users} value={item.customer_count ?? 0} label="客户数" />
        <MetricCard icon={ShieldUser} value={item.active_subscription_count ?? 0} label="活跃订阅" />
        <MetricCard icon={BadgeDollarSign} value={formatCurrency(item.approved_amount_total ?? 0)} label="累计批准金额" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基础资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <PropertyRow label="用户名" value={item.username} />
          <PropertyRow label="显示名称" value={item.display_name || "未设置"} />
          <PropertyRow label="角色" value={item.role} />
          <PropertyRow label="佣金比例" value={`${((item.commission_rate ?? 0) * 100).toFixed(1)}%`} />
          <PropertyRow label="状态" value={item.status === 1 ? "启用" : "禁用"} />
          <PropertyRow label="创建时间" value={formatDateTime(item.created_at)} />
          <PropertyRow label="更新时间" value={formatDateTime(item.updated_at)} />
        </CardContent>
      </Card>

      <AgentPasswordResetDialog
        open={resetOpen}
        agent={item}
        pending={resetPasswordMutation.isPending}
        onClose={() => setResetOpen(false)}
        onSubmit={(newPassword) => resetPasswordMutation.mutate(newPassword)}
      />
    </div>
  );
}
