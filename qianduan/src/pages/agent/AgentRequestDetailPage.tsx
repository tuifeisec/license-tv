import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { cancelAgentRequest, getAgentRequest } from "@/api/agent/requests";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaymentProofCard } from "@/components/PaymentProofCard";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import { AlertTriangle } from "lucide-react";

export function AgentRequestDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const query = useQuery({
    queryKey: ["agent-request", id],
    queryFn: () => getAgentRequest(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAgentRequest(id),
    onSuccess: () => {
      notify({ title: "申请已取消", tone: "warning" });
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agent-request", id] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="申请详情"
          description="当前无法加载申请详情，请稍后重试。"
          actions={
            <Button variant="outline" onClick={() => query.refetch()}>
              重新加载
            </Button>
          }
        />
        <EmptyState icon={AlertTriangle} message="申请详情加载失败。" />
      </div>
    );
  }

  const item = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`申请详情 · ${item.request_no}`}
        description="申请详情为只读视图，待审核状态下可以撤回。"
        actions={
          item.status === "pending" ? (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              取消申请
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>申请信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PropertyRow label="状态" value={<StatusBadge status={item.status} />} />
            <PropertyRow label="套餐" value={<PlanTypeBadge value={item.plan_type} />} />
            <PropertyRow label="金额" value={formatCurrency(item.amount)} />
            <PropertyRow label="提交时间" value={formatDateTime(item.created_at)} />
            <PropertyRow label="备注" value={item.remark || "—"} />
            <PropertyRow label="拒绝原因" value={item.reject_reason || "—"} />
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
            <PropertyRow label="脚本类型" value={item.script?.kind ?? "—"} />
            <PropertyRow label="版本" value={item.script?.version ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>付款凭证</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentProofCard url={item.payment_proof} emptyText="该申请还没有付款凭证。" />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        pending={cancelMutation.isPending}
        title="确认取消申请"
        description="取消后该申请不会进入管理员审核流。"
        confirmText="确认取消"
      />
    </div>
  );
}
