import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PlanTypeSelect } from "@/components/PlanTypeSelect";
import { PropertyRow } from "@/components/PropertyRow";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { PlanType, Subscription } from "@/types/api";

const planSummaryMap: Record<PlanType, string> = {
  monthly: "按月付规则顺延 1 个月",
  quarterly: "按季付规则顺延 3 个月",
  yearly: "按年付规则顺延 1 年",
  lifetime: "调整为长期有效",
  trial: "按试用方案顺延试用期",
};

export function SubscriptionRenewDialog({
  open,
  subscription,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  subscription: Subscription | null;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (payload: { plan_type: PlanType; requested_days?: number }) => void;
}) {
  const [planType, setPlanType] = useState<PlanType>("monthly");
  const [requestedDays, setRequestedDays] = useState("");

  useEffect(() => {
    if (!open || !subscription) {
      return;
    }
    setPlanType(subscription.plan_type);
    setRequestedDays("");
  }, [open, subscription]);

  const normalizedDays = useMemo(() => {
    if (requestedDays.trim() === "") {
      return undefined;
    }

    const parsed = Number(requestedDays);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.floor(parsed);
  }, [requestedDays]);

  const customDaysEnabled = typeof normalizedDays === "number";
  const canSubmit = Boolean(subscription) && normalizedDays !== null;
  const executionSummary = customDaysEnabled
    ? `将在当前有效期基础上顺延 ${normalizedDays} 天`
    : planSummaryMap[planType];

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        if (!subscription || !canSubmit) {
          return;
        }

        onSubmit({
          plan_type: planType,
          requested_days: normalizedDays ?? undefined,
        });
      }}
      pending={pending}
      title="确认续费"
      description={
        subscription
          ? `为 ${subscription.customer?.tv_username ?? "该客户"} 调整订阅时长，续费会立即同步到 TradingView 授权。`
          : undefined
      }
      confirmText="确认续费"
    >
      {subscription ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-background/30 p-4">
            <div className="mb-2 text-sm font-semibold">当前授权</div>
            <div className="space-y-1">
              <PropertyRow label="客户" value={subscription.customer?.tv_username ?? "—"} />
              <PropertyRow label="脚本" value={subscription.script?.name ?? "—"} />
              <PropertyRow label="当前套餐" value={<PlanTypeBadge value={subscription.plan_type} />} />
              <PropertyRow label="当前到期" value={formatDate(subscription.expires_at)} />
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border border-border/70 bg-background/30 p-4 md:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">续费套餐</div>
              <PlanTypeSelect value={planType} onChange={(value) => setPlanType(value as PlanType)} />
              <p className="text-xs text-muted-foreground">留空自定义天数时，系统会按所选套餐自动计算续费时长。</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">自定义天数</div>
              <Input
                type="number"
                min={0}
                step={1}
                value={requestedDays}
                onChange={(event) => setRequestedDays(event.target.value)}
                placeholder="留空按套餐"
              />
              <p className="text-xs text-muted-foreground">填写后会优先按天数续费。</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">本次执行规则</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  续费基准取“当前到期时间”和“现在”中更晚者，避免未到期订阅被提前覆盖。
                </p>
              </div>
              <Badge variant={customDaysEnabled ? "warning" : "success"}>
                {customDaysEnabled ? `自定义 ${normalizedDays} 天` : "按套餐自动计算"}
              </Badge>
            </div>

            <div className="mt-3 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm">
              {executionSummary}
            </div>

            {normalizedDays === null ? (
              <p className="mt-2 text-xs text-destructive">自定义天数必须大于 0，留空则按套餐规则续费。</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
