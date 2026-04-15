import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, KeyRound, PencilLine, ShieldUser, Users } from "lucide-react";

import { getAgent } from "@/api/agents";
import { MetricCard } from "@/components/MetricCard";
import { PropertyRow } from "@/components/PropertyRow";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { AgentDetail } from "@/types/api";

function buildHints(agent: AgentDetail) {
  const hints: string[] = [];

  if (agent.status !== 1) {
    hints.push("当前代理账号已禁用，无法继续登录代理端。");
  }
  if ((agent.customer_count ?? 0) === 0) {
    hints.push("当前还没有绑定客户，适合优先分配测试客户或首单线索。");
  }
  if ((agent.customer_count ?? 0) > 0 && (agent.active_subscription_count ?? 0) === 0) {
    hints.push("已有客户但暂无活跃订阅，适合优先跟进授权转化或续费。");
  }
  if ((agent.approved_amount_total ?? 0) > 0) {
    hints.push("该代理已经产生批准流水，可结合客户与续费情况继续复盘转化。");
  }

  return hints;
}

export function AgentQuickViewPanel({
  agent,
  open,
  onClose,
  onEdit,
  onResetPassword,
  onOpenDetail,
}: {
  agent: AgentDetail | null;
  open: boolean;
  onClose: () => void;
  onEdit: (agent: AgentDetail) => void;
  onResetPassword: (agent: AgentDetail) => void;
  onOpenDetail: (agent: AgentDetail) => void;
}) {
  const query = useQuery({
    queryKey: ["agent", agent?.id, "quick-view"],
    queryFn: () => getAgent(agent!.id),
    enabled: open && Boolean(agent?.id),
  });

  const item = query.data ?? agent;
  const hints = item ? buildHints(item) : [];

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={item ? `${item.display_name || item.username} · 代理速览` : "代理速览"}
      description="在列表页快速查看代理运营状态，减少来回跳转。"
      footer={
        item ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              关闭
            </Button>
            <Button variant="outline" onClick={() => onResetPassword(item)}>
              <KeyRound className="size-4" />
              重置密码
            </Button>
            <Button variant="outline" onClick={() => onEdit(item)}>
              <PencilLine className="size-4" />
              编辑资料
            </Button>
            <Button onClick={() => onOpenDetail(item)}>查看完整详情</Button>
          </>
        ) : undefined
      }
    >
      {query.isLoading && !item ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl border border-border bg-accent/30" />
          <div className="h-20 animate-pulse rounded-xl border border-border bg-accent/20" />
          <div className="h-32 animate-pulse rounded-xl border border-border bg-accent/20" />
        </div>
      ) : item ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard icon={Users} value={item.customer_count ?? 0} label="客户数" />
            <MetricCard icon={ShieldUser} value={item.active_subscription_count ?? 0} label="活跃订阅" />
            <MetricCard
              icon={BadgeDollarSign}
              value={formatCurrency(item.approved_amount_total ?? 0)}
              label="累计批准金额"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="mb-2 text-sm font-semibold">基础信息</div>
            <div className="space-y-1">
              <PropertyRow label="用户名" value={item.username} />
              <PropertyRow label="显示名称" value={item.display_name || "未设置"} />
              <PropertyRow label="角色" value={item.role} />
              <PropertyRow label="佣金比例" value={`${((item.commission_rate ?? 0) * 100).toFixed(1)}%`} />
              <PropertyRow label="状态" value={item.status === 1 ? "启用" : "禁用"} />
              <PropertyRow label="创建时间" value={formatDateTime(item.created_at)} />
              <PropertyRow label="最近更新" value={formatDateTime(item.updated_at)} />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="mb-2 text-sm font-semibold">运营提示</div>
            {hints.length > 0 ? (
              <div className="space-y-2">
                {hints.map((hint) => (
                  <div key={hint} className="rounded-lg border border-border/60 bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
                    {hint}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">当前代理状态稳定，可继续结合客户列表做精细化跟进。</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
          暂时无法加载代理详情，请稍后重试。
        </div>
      )}
    </SidePanel>
  );
}
