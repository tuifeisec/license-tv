import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  ShieldUser,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAgentDashboardStats } from "@/api/agent/stats";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PropertyRow } from "@/components/PropertyRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value) * 100)}%`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCommissionRate(value?: number | null) {
  const percentage = Number(value ?? 0) * 100;
  return Number.isInteger(percentage) ? `${percentage}%` : `${percentage.toFixed(1)}%`;
}

function colorVar(name: "chart1" | "chart2" | "chart3" | "chart4" | "chart5" | "danger") {
  return {
    chart1: "var(--chart-1)",
    chart2: "var(--chart-2)",
    chart3: "var(--chart-3)",
    chart4: "var(--chart-4)",
    chart5: "var(--chart-5)",
    danger: "var(--destructive)",
  }[name];
}

function SectionKicker({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</div>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  meta,
  color,
  ratio,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
  color: string;
  ratio: number;
}) {
  return (
    <Card>
      <CardContent className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <SectionKicker>{label}</SectionKicker>
            <div className="text-xl font-bold tracking-tight">{value}</div>
            <div className="text-[11px] text-muted-foreground">{meta}</div>
          </div>
          <div
            className="rounded-md border border-border/70 p-1.5"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted/70">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.max(8, Math.round(clamp(ratio) * 100))}%`, backgroundColor: color }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StackBar({
  segments,
  total,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted/70">
        {segments
          .filter((item) => item.value > 0)
          .map((item) => (
            <div
              key={item.label}
              className="h-full"
              style={{
                width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {segments.map((item) => (
          <div key={item.label} className="rounded-lg border border-border/70 bg-background/35 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <div className="mt-1 text-sm font-semibold">{formatCount(item.value)}</div>
            <div className="text-[11px] text-muted-foreground">
              {total > 0 ? formatPercent(item.value / total) : "0%"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildWaffleCells(
  items: Array<{ label: string; value: number; color: string }>,
  total: number,
  cellCount = 32,
) {
  if (total <= 0) {
    return Array.from({ length: cellCount }, (_, index) => ({
      key: `empty-${index}`,
      label: "empty",
      color: "var(--muted)",
    }));
  }

  const normalized = items.map((item) => ({
    ...item,
    exact: (item.value / total) * cellCount,
    cells: Math.floor((item.value / total) * cellCount),
  }));

  let used = normalized.reduce((sum, item) => sum + item.cells, 0);
  let remainder = cellCount - used;

  const ranked = [...normalized].sort((a, b) => b.exact - a.exact);
  let cursor = 0;
  while (remainder > 0 && ranked.length > 0) {
    ranked[cursor % ranked.length].cells += 1;
    remainder -= 1;
    cursor += 1;
  }

  return normalized.flatMap((item, index) =>
    Array.from({ length: item.cells }, (_, cellIndex) => ({
      key: `${item.label}-${index}-${cellIndex}`,
      label: item.label,
      color: item.color,
    })),
  );
}

function WafflePanel({
  items,
  total,
}: {
  total: number;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const cells = buildWaffleCells(items, total);

  return (
    <div className="space-y-2.5 rounded-lg border border-border/70 bg-background/35 px-2.5 py-2.5">
      <div className="grid grid-cols-8 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="aspect-square rounded-[4px]"
            style={{ backgroundColor: cell.color }}
            title={cell.label}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const ratio = total > 0 ? value / total : 0;

  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/35 px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">{formatCount(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.round(clamp(ratio) * 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">{formatPercent(ratio)}</div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const ratio = total > 0 ? value / total : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{formatCount(value)}</span>
      </div>
      <div className="h-8 overflow-hidden rounded-lg border border-border/70 bg-background/35">
        <div
          className="flex h-full items-center px-2 text-xs font-medium text-card-foreground transition-[width] duration-300"
          style={{
            width: `${Math.max(14, Math.round(clamp(ratio) * 100))}%`,
            backgroundColor: color,
          }}
        >
          {formatPercent(ratio)}
        </div>
      </div>
    </div>
  );
}

function RevenueRow({
  label,
  value,
  ratio,
  color,
  meta,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  meta: string;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/35 px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.round(clamp(ratio) * 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{meta}</span>
        <span>{formatPercent(ratio)}</span>
      </div>
    </div>
  );
}

function RevenueSnapshot({
  share,
  monthCommission,
  totalCommission,
  color,
}: {
  share: number;
  monthCommission: number;
  totalCommission: number;
  color: string;
}) {
  const safeValue = clamp(share);
  const degrees = safeValue * 360;

  return (
    <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/35 px-3 py-3">
      <div className="text-xs text-muted-foreground">月度占比</div>
      <div className="mt-3 flex items-center justify-center">
        <div
          className="relative size-18 rounded-full"
          style={{
            background: `conic-gradient(${color} 0deg ${degrees}deg, var(--muted) ${degrees}deg 360deg)`,
          }}
        >
          <div className="absolute inset-[8px] flex flex-col items-center justify-center rounded-full bg-card">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Share</span>
            <span className="text-sm font-semibold">{formatPercent(safeValue)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 border-t border-border/60 pt-2.5">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">本月佣金</span>
          <span className="font-semibold text-foreground">{formatCurrency(monthCommission)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">累计佣金</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalCommission)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/35 px-2.5 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  );
}

function CompactRing({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const safeValue = clamp(value);
  const degrees = safeValue * 360;

  return (
    <div className="rounded-lg border border-border/70 bg-background/35 px-2.5 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2.5 flex items-center gap-3">
        <div
          className="relative size-16 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(${color} 0deg ${degrees}deg, var(--muted) ${degrees}deg 360deg)`,
          }}
        >
          <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-card text-[11px] font-semibold">
            {formatPercent(safeValue)}
          </div>
        </div>
        <div className="text-base font-semibold">{formatPercent(safeValue)}</div>
      </div>
    </div>
  );
}

function ShortcutTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-start gap-3 rounded-lg border border-border/70 bg-background/35 px-3 py-3 text-left transition-colors duration-200 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-[3px]"
    >
      <div className="rounded-md border border-border/70 bg-background/70 p-2 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export function AgentDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: ["agent-dashboard-stats"],
    queryFn: getAgentDashboardStats,
  });
  const commissionRate = Number(user?.commission_rate ?? 0);

  const derived = useMemo(() => {
    const data = query.data;
    if (!data) {
      return null;
    }

    const activeRatio = data.customer_count > 0 ? data.active_subscription_count / data.customer_count : 0;
    const pendingRatio = data.customer_count > 0 ? data.pending_request_count / data.customer_count : 0;
    const monthlyShare = data.approved_amount_total > 0 ? data.approved_amount_month / data.approved_amount_total : 0;
    const uncoveredCount = Math.max(0, data.customer_count - data.active_subscription_count - data.pending_request_count);
    const uncoveredRatio = data.customer_count > 0 ? uncoveredCount / data.customer_count : 0;
    const coveredCount = Math.min(data.customer_count, data.active_subscription_count + data.pending_request_count);
    const coverageRatio = data.customer_count > 0 ? coveredCount / data.customer_count : 0;
    const activeInCoveredRatio = coveredCount > 0 ? data.active_subscription_count / coveredCount : 0;
    const pressureRatio = Math.max(pendingRatio, uncoveredRatio);
    const monthCommission = data.approved_amount_month * commissionRate;
    const totalCommission = data.approved_amount_total * commissionRate;
    const countBase = Math.max(
      data.customer_count,
      data.active_subscription_count,
      data.pending_request_count,
      uncoveredCount,
      1,
    );
    const revenueBase = Math.max(data.approved_amount_total, data.approved_amount_month, 1);

    return {
      activeRatio,
      pendingRatio,
      monthlyShare,
      uncoveredCount,
      uncoveredRatio,
      coveredCount,
      coverageRatio,
      activeInCoveredRatio,
      pressureRatio,
      monthCommission,
      totalCommission,
      countBase,
      revenueBase,
      customerSegments: [
        { label: "活跃订阅", value: data.active_subscription_count, color: colorVar("chart2") },
        { label: "待审核", value: data.pending_request_count, color: colorVar("chart4") },
        { label: "未覆盖", value: uncoveredCount, color: colorVar("chart5") },
      ],
    };
  }, [commissionRate, query.data]);

  if (query.isLoading) {
    return <PageSkeleton />;
  }

  if (query.isError || !query.data || !derived) {
    return (
      <div className="space-y-3">
        <PageHeader
          title="代理总览"
          className="px-4 py-3"
          actions={
            <Button size="sm" onClick={() => query.refetch()}>
              重新加载
            </Button>
          }
        />
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>数据暂不可用</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const data = query.data;
  const displayName = user?.display_name || user?.username || "代理伙伴";
  const accountStatusLabel = user?.status === 1 ? "正常" : "停用";
  const accountStatusVariant = user?.status === 1 ? "success" : "destructive";

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="代理总览"
        className="px-4 py-2.5"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("/agent/customers")}>
              <Users className="size-4" />
              客户
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/agent/requests")}>
              <TrendingUp className="size-4" />
              申请
            </Button>
            <Button size="sm" onClick={() => navigate("/agent/requests/new")}>
              <ClipboardCheck className="size-4" />
              新建申请
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          icon={Users}
          label="客户"
          value={formatCount(data.customer_count)}
          meta={`未覆盖 ${formatCount(derived.uncoveredCount)}`}
          color={colorVar("chart1")}
          ratio={data.customer_count / derived.countBase}
        />
        <KpiCard
          icon={ShieldUser}
          label="活跃"
          value={formatCount(data.active_subscription_count)}
          meta={formatPercent(derived.activeRatio)}
          color={colorVar("chart2")}
          ratio={data.active_subscription_count / derived.countBase}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="待审"
          value={formatCount(data.pending_request_count)}
          meta={formatPercent(derived.pendingRatio)}
          color={colorVar("chart4")}
          ratio={data.pending_request_count / derived.countBase}
        />
        <KpiCard
          icon={TrendingUp}
          label="机会池"
          value={formatCount(derived.uncoveredCount)}
          meta={formatPercent(derived.uncoveredRatio)}
          color={colorVar("chart5")}
          ratio={derived.uncoveredCount / derived.countBase}
        />
        <KpiCard
          icon={Wallet}
          label="本月批准"
          value={formatCurrency(data.approved_amount_month)}
          meta={formatPercent(derived.monthlyShare)}
          color={colorVar("chart2")}
          ratio={data.approved_amount_month / derived.revenueBase}
        />
        <KpiCard
          icon={Wallet}
          label="累计批准"
          value={formatCurrency(data.approved_amount_total)}
          meta={`佣金 ${formatCommissionRate(user?.commission_rate)}`}
          color={colorVar("chart3")}
          ratio={data.approved_amount_total / derived.revenueBase}
        />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.62fr)_292px]">
        <div className="grid gap-2.5">
          <div className="grid gap-2.5 xl:grid-cols-[1.16fr_0.84fr]">
            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle>客户池结构</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 px-4 py-2.5">
                <StackBar total={Math.max(data.customer_count, 1)} segments={derived.customerSegments} />
                <WafflePanel total={Math.max(data.customer_count, 1)} items={derived.customerSegments} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle>转化漏斗</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 px-4 py-2.5">
                <FunnelRow
                  label="客户池"
                  value={data.customer_count}
                  total={Math.max(data.customer_count, 1)}
                  color={colorVar("chart1")}
                />
                <FunnelRow
                  label="已覆盖"
                  value={derived.coveredCount}
                  total={Math.max(data.customer_count, 1)}
                  color={colorVar("chart3")}
                />
                <FunnelRow
                  label="活跃订阅"
                  value={data.active_subscription_count}
                  total={Math.max(data.customer_count, 1)}
                  color={colorVar("chart2")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <SummaryPill
                    label="待审压力"
                    value={formatPercent(derived.pendingRatio)}
                    color={derived.pendingRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
                  />
                  <SummaryPill
                    label="机会池"
                    value={formatPercent(derived.uncoveredRatio)}
                    color={colorVar("chart5")}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-2.5 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle>收入驾驶</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_148px]">
                <div className="grid gap-2">
                  <RevenueRow
                    label="累计批准"
                    value={formatCurrency(data.approved_amount_total)}
                    ratio={data.approved_amount_total / derived.revenueBase}
                    color={colorVar("chart3")}
                    meta={`累计佣金 ${formatCurrency(derived.totalCommission)}`}
                  />
                  <RevenueRow
                    label="本月批准"
                    value={formatCurrency(data.approved_amount_month)}
                    ratio={data.approved_amount_month / derived.revenueBase}
                    color={colorVar("chart2")}
                    meta={`本月佣金 ${formatCurrency(derived.monthCommission)}`}
                  />
                  <RevenueRow
                    label="佣金率"
                    value={formatCommissionRate(commissionRate)}
                    ratio={commissionRate}
                    color={colorVar("chart1")}
                    meta={`每 ¥100 批准约得 ${formatCurrency(100 * commissionRate)}`}
                  />
                </div>
                <RevenueSnapshot
                  share={derived.monthlyShare}
                  monthCommission={derived.monthCommission}
                  totalCommission={derived.totalCommission}
                  color={colorVar("chart2")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle>执行监控</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 px-4 py-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <CompactRing label="覆盖率" value={derived.coverageRatio} color={colorVar("chart1")} />
                  <CompactRing
                    label="活跃占覆盖"
                    value={derived.activeInCoveredRatio}
                    color={colorVar("chart2")}
                  />
                </div>
                <div className="grid gap-2">
                  <MetricRow
                    label="已覆盖"
                    value={derived.coveredCount}
                    total={Math.max(data.customer_count, 1)}
                    color={colorVar("chart1")}
                  />
                  <MetricRow
                    label="待审压力"
                    value={data.pending_request_count}
                    total={Math.max(data.customer_count, 1)}
                    color={derived.pendingRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
                  />
                  <MetricRow
                    label="未覆盖"
                    value={derived.uncoveredCount}
                    total={Math.max(data.customer_count, 1)}
                    color={colorVar("chart5")}
                  />
                </div>
                <SummaryPill
                  label="综合压力"
                  value={formatPercent(derived.pressureRatio)}
                  color={derived.pressureRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-2.5">
          <Card>
            <CardHeader className="px-4 py-2.5">
              <CardTitle>控制台</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-4 py-2.5">
              <div className="flex items-center gap-2 pb-1">
                <Badge variant="outline">{displayName}</Badge>
                <Badge variant={accountStatusVariant}>{accountStatusLabel}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryPill label="佣金率" value={formatCommissionRate(user?.commission_rate)} color={colorVar("chart1")} />
                <SummaryPill label="客户数" value={formatCount(data.customer_count)} color={colorVar("chart3")} />
              </div>
              <div className="space-y-1">
                <PropertyRow label="身份" value="代理" />
                <PropertyRow label="活跃" value={formatCount(data.active_subscription_count)} />
                <PropertyRow label="待审" value={formatCount(data.pending_request_count)} />
                <PropertyRow label="机会池" value={formatCount(derived.uncoveredCount)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutTile icon={ClipboardCheck} label="新建申请" onClick={() => navigate("/agent/requests/new")} />
                <ShortcutTile icon={Users} label="客户列表" onClick={() => navigate("/agent/customers")} />
                <ShortcutTile icon={TrendingUp} label="申请记录" onClick={() => navigate("/agent/requests")} />
                <ShortcutTile icon={ShieldUser} label="脚本目录" onClick={() => navigate("/agent/scripts")} />
                <ShortcutTile icon={Building2} label="TV 注册" onClick={() => navigate("/agent/tv-register")} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
