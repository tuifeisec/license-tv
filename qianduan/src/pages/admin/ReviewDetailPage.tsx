import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";

import { approveReview, getReview, rejectReview } from "@/api/reviews";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaymentProofCard } from "@/components/PaymentProofCard";
import { PaymentProofStatusBadge } from "@/components/PaymentProofStatusBadge";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { RejectDialog } from "@/components/RejectDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";

function ReviewCheckRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div>{value}</div>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export function ReviewDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const query = useQuery({
    queryKey: ["review", id],
    queryFn: () => getReview(id),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveReview(id),
    onSuccess: () => {
      notify({ title: "审核通过成功", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["review", id] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectReview(id, { reason }),
    onSuccess: () => {
      setRejectOpen(false);
      notify({ title: "申请已拒绝", tone: "warning" });
      queryClient.invalidateQueries({ queryKey: ["review", id] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="审核详情"
          description="当前无法加载审核详情，请稍后重试。"
          actions={
            <Button variant="outline" onClick={() => query.refetch()}>
              重新加载
            </Button>
          }
        />
        <EmptyState icon={AlertTriangle} message="审核详情加载失败。" />
      </div>
    );
  }

  const item = query.data;
  const hasPaymentProof = Boolean(item.payment_proof);
  const amountValid = Number(item.amount) > 0;
  const planReady = Boolean(item.plan_type);
  const usernameReady = Boolean(item.customer?.tv_username);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`审核详情 · ${item.request_no}`}
        description="审核通过前请核对用户名、套餐、金额和付款凭证，审核动作会同步写入操作日志。"
        actions={
          item.status === "pending" ? (
            <>
              <Button variant="outline" onClick={() => setRejectOpen(true)}>
                拒绝
              </Button>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? "处理中..." : "通过申请"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>申请信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <PropertyRow label="状态" value={<StatusBadge status={item.status} />} />
            <PropertyRow label="套餐" value={<PlanTypeBadge value={item.plan_type} />} />
            <PropertyRow label="金额" value={formatCurrency(item.amount)} />
            <PropertyRow label="操作类型" value={item.action} />
            <PropertyRow label="提交时间" value={formatDateTime(item.created_at)} />
            <PropertyRow label="审核时间" value={formatDateTime(item.reviewed_at)} />
            <PropertyRow label="备注" value={item.remark || "—"} />
            <PropertyRow label="拒绝原因" value={item.reject_reason || "—"} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>客户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <PropertyRow label="TV 用户名" value={item.customer?.tv_username ?? "—"} />
              <PropertyRow label="联系方式" value={item.customer?.contact ?? "—"} />
              <PropertyRow label="代理" value={item.agent?.display_name ?? item.agent?.username ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>脚本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <PropertyRow label="脚本名称" value={item.script?.name ?? "—"} />
              <PropertyRow label="月付价格" value={formatCurrency(item.script?.monthly_price)} />
              <PropertyRow label="描述" value={item.script?.description ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>核验要点</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ReviewCheckRow
                label="付款凭证"
                value={<PaymentProofStatusBadge value={item.payment_proof} />}
                hint={hasPaymentProof ? "已上传凭证，可直接查看截图和原图。" : "缺少凭证时不建议直接通过审核。"}
              />
              <ReviewCheckRow
                label="申请金额"
                value={amountValid ? <StatusBadge status="approved" /> : <StatusBadge status="rejected" />}
                hint={amountValid ? `当前申请金额 ${formatCurrency(item.amount)}，请与凭证金额人工核对。` : "金额未填写或无效，请先驳回补正。"}
              />
              <ReviewCheckRow
                label="套餐信息"
                value={planReady ? <StatusBadge status="approved" /> : <StatusBadge status="rejected" />}
                hint={planReady ? "已选择套餐，审核时确认与付款内容一致。" : "套餐信息缺失，需退回重新提交。"}
              />
              <ReviewCheckRow
                label="用户名终检"
                value={usernameReady ? <StatusBadge status="pending" /> : <StatusBadge status="rejected" />}
                hint={usernameReady ? "点击“通过申请”时会执行最终用户名校验与标准化。" : "当前缺少 TV 用户名，无法进入通过流程。"}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>付款凭证</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentProofCard url={item.payment_proof} emptyText="该申请未上传付款凭证。" />
        </CardContent>
      </Card>

      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={(reason) => rejectMutation.mutate(reason)}
        pending={rejectMutation.isPending}
      />
    </div>
  );
}
