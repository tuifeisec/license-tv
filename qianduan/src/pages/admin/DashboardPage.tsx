import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardCheck,
  ShieldUser,
  UserRoundCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { getAdminDashboardStats } from "@/api/system";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value) * 100)}%`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
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

function Kicker({ children }: { children: string }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</div>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  meta,
  ratio,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
  ratio: number;
  color: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Kicker>{label}</Kicker>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <div className="text-[11px] text-muted-foreground">{meta}</div>
          </div>
          <div
            className="rounded-lg border border-border/70 p-2"
            style={{ backgroundColor: `${color}14`, color }}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.max(10, Math.round(clamp(ratio) * 100))}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RingGauge({
  label,
  value,
  color,
  detail,
}: {
  label: string;
  value: number;
  color: string;
  detail: string;
}) {
  const safeValue = clamp(value);
  const degrees = safeValue * 360;

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="relative size-18 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(${color} 0deg ${degrees}deg, var(--muted) ${degrees}deg 360deg)`,
          }}
        >
          <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-card text-xs font-semibold">
            {formatPercent(safeValue)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold">{formatPercent(safeValue)}</div>
          <div className="text-[11px] text-muted-foreground">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function SegmentBar({
  total,
  segments,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted/80">
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
      <div className="grid gap-2 sm:grid-cols-3">
        {segments.map((item) => (
          <div key={item.label} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <div className="mt-1 text-base font-semibold">{formatCount(item.value)}</div>
            <div className="text-[11px] text-muted-foreground">{total > 0 ? formatPercent(item.value / total) : "0%"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatGrid({
  total,
  segments,
}: {
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const cellCount = 40;

  const cells = useMemo(() => {
    if (total <= 0) {
      return Array.from({ length: cellCount }, (_, index) => ({
        key: `empty-${index}`,
        color: "var(--muted)",
        label: "empty",
      }));
    }

    const normalized = segments.map((item) => ({
      ...item,
      exact: (item.value / total) * cellCount,
      cells: Math.floor((item.value / total) * cellCount),
    }));

    let remainder = cellCount - normalized.reduce((sum, item) => sum + item.cells, 0);
    const ranked = [...normalized].sort((a, b) => b.exact - a.exact);
    let cursor = 0;

    while (remainder > 0 && ranked.length > 0) {
      ranked[cursor % ranked.length].cells += 1;
      remainder -= 1;
      cursor += 1;
    }

    return normalized.flatMap((item, groupIndex) =>
      Array.from({ length: item.cells }, (_, cellIndex) => ({
        key: `${item.label}-${groupIndex}-${cellIndex}`,
        color: item.color,
        label: item.label,
      })),
    );
  }, [segments, total]);

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
      <div className="grid grid-cols-10 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="aspect-square rounded-[4px]"
            style={{ backgroundColor: cell.color }}
            title={cell.label}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareColumns({
  items,
}: {
  items: Array<{ label: string; value: number; display: string; color: string }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-3">
      <div className="flex h-32 items-end gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-[11px] font-medium text-foreground">{item.display}</div>
            <div className="flex h-full w-full items-end rounded-md bg-muted/45 p-1">
              <div
                className="w-full rounded-sm transition-[height] duration-300"
                style={{
                  height: `${Math.max(10, Math.round((item.value / maxValue) * 100))}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EfficiencyRow({
  label,
  value,
  helper,
  ratio,
  color,
}: {
  label: string;
  value: string;
  helper: string;
  ratio: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(8, Math.round(clamp(ratio) * 100))}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{helper}</div>
    </div>
  );
}

export function DashboardPage() {
  const query = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: getAdminDashboardStats,
  });

  const derived = useMemo(() => {
    const data = query.data;
    if (!data) {
      return null;
    }

    const customerBase = Math.max(data.customer_count, 1);
    const teamCount = data.admin_count + data.agent_count;
    const teamBase = Math.max(teamCount, 1);
    const coveredCount = Math.min(data.customer_count, data.active_subscription_count + data.pending_request_count);
    const uncoveredCount = Math.max(0, data.customer_count - coveredCount);
    const coverageRatio = coveredCount / customerBase;
    const activeRatio = data.active_subscription_count / customerBase;
    const pendingRatio = data.pending_request_count / customerBase;
    const uncoveredRatio = uncoveredCount / customerBase;
    const pressureRatio = Math.max(pendingRatio, uncoveredRatio);
    const healthScore = clamp(coverageRatio * 0.6 + (1 - pressureRatio) * 0.4);
    const agentLoad = data.agent_count > 0 ? data.customer_count / data.agent_count : 0;
    const activePerAgent = data.agent_count > 0 ? data.active_subscription_count / data.agent_count : 0;
    const pendingPerAgent = data.agent_count > 0 ? data.pending_request_count / data.agent_count : 0;
    const amountPerAgent = data.agent_count > 0 ? data.approved_amount_month / data.agent_count : 0;
    const amountPerCustomer = data.customer_count > 0 ? data.approved_amount_month / data.customer_count : 0;
    const customerWorkBase = Math.max(data.customer_count, data.active_subscription_count, data.pending_request_count, uncoveredCount, 1);
    const efficiencyBase = Math.max(agentLoad, activePerAgent, pendingPerAgent, 1);
    const revenueBase = Math.max(data.approved_amount_total, data.approved_amount_month, 1);

    return {
      teamCount,
      coveredCount,
      uncoveredCount,
      coverageRatio,
      activeRatio,
      pendingRatio,
      uncoveredRatio,
      pressureRatio,
      healthScore,
      agentLoad,
      activePerAgent,
      pendingPerAgent,
      amountPerAgent,
      amountPerCustomer,
      customerWorkBase,
      efficiencyBase,
      revenueBase,
      customerSegments: [
        { label: "活跃订阅", value: data.active_subscription_count, color: colorVar("chart2") },
        { label: "待审核", value: data.pending_request_count, color: colorVar("chart4") },
        { label: "未覆盖", value: uncoveredCount, color: colorVar("chart5") },
      ],
      teamSegments: [
        { label: "管理员", value: data.admin_count, color: colorVar("chart1") },
        { label: "代理", value: data.agent_count, color: colorVar("chart3") },
      ],
      compareColumns: [
        { label: "管理员", value: data.admin_count, display: formatCount(data.admin_count), color: colorVar("chart1") },
        { label: "代理", value: data.agent_count, display: formatCount(data.agent_count), color: colorVar("chart3") },
        { label: "客户", value: data.customer_count, display: formatCount(data.customer_count), color: colorVar("chart2") },
        {
          label: "活跃订阅",
          value: data.active_subscription_count,
          display: formatCount(data.active_subscription_count),
          color: colorVar("chart4"),
        },
      ],
    };
  }, [query.data]);

  if (query.isLoading) {
    return <PageSkeleton />;
  }

  if (query.isError || !query.data || !derived) {
    return (
      <div className="space-y-3">
        <PageHeader
          title="总览看板"
          className="px-4 py-3"
          actions={
            <Button size="sm" onClick={() => query.refetch()}>
              刷新
            </Button>
          }
        />
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>看板数据暂不可用</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="space-y-3">
      <PageHeader
        title="总览看板"
        className="px-4 py-3"
        actions={
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            刷新
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="客户池"
          value={formatCount(data.customer_count)}
          meta={`覆盖 ${formatPercent(derived.coverageRatio)}`}
          ratio={data.customer_count / derived.customerWorkBase}
          color={colorVar("chart1")}
        />
        <MetricCard
          icon={ShieldUser}
          label="活跃订阅"
          value={formatCount(data.active_subscription_count)}
          meta={`占客户 ${formatPercent(derived.activeRatio)}`}
          ratio={data.active_subscription_count / derived.customerWorkBase}
          color={colorVar("chart2")}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="待审压力"
          value={formatCount(data.pending_request_count)}
          meta={`占客户 ${formatPercent(derived.pendingRatio)}`}
          ratio={data.pending_request_count / derived.customerWorkBase}
          color={derived.pendingRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
        />
        <MetricCard
          icon={Wallet}
          label="本月批准"
          value={formatCurrency(data.approved_amount_month)}
          meta={`客单 ${formatCurrency(derived.amountPerCustomer)}`}
          ratio={derived.healthScore}
          color={colorVar("chart3")}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.88fr)]">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>业务结构</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-3">
            <SegmentBar total={Math.max(data.customer_count, 1)} segments={derived.customerSegments} />
            <HeatGrid total={Math.max(data.customer_count, 1)} segments={derived.customerSegments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>执行仪表</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <RingGauge
                label="覆盖率"
                value={derived.coverageRatio}
                color={colorVar("chart1")}
                detail={`${formatCount(derived.coveredCount)} / ${formatCount(data.customer_count)}`}
              />
              <RingGauge
                label="健康度"
                value={derived.healthScore}
                color={colorVar("chart2")}
                detail={`压力 ${formatPercent(derived.pressureRatio)}`}
              />
            </div>
            <div className="grid gap-2">
              <EfficiencyRow
                label="每代理客户"
                value={data.agent_count > 0 ? derived.agentLoad.toFixed(1) : "0.0"}
                helper={`代理 ${formatCount(data.agent_count)}`}
                ratio={derived.agentLoad / derived.efficiencyBase}
                color={colorVar("chart3")}
              />
              <EfficiencyRow
                label="每代理活跃"
                value={data.agent_count > 0 ? derived.activePerAgent.toFixed(1) : "0.0"}
                helper={`活跃 ${formatCount(data.active_subscription_count)}`}
                ratio={derived.activePerAgent / derived.efficiencyBase}
                color={colorVar("chart2")}
              />
              <EfficiencyRow
                label="每代理待审"
                value={data.agent_count > 0 ? derived.pendingPerAgent.toFixed(1) : "0.0"}
                helper={`待审 ${formatCount(data.pending_request_count)}`}
                ratio={derived.pendingPerAgent / derived.efficiencyBase}
                color={derived.pendingRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
              />
              <EfficiencyRow
                label="月批 / 代理"
                value={formatCurrency(derived.amountPerAgent)}
                helper={`本月 ${formatCurrency(data.approved_amount_month)}`}
                ratio={derived.healthScore}
                color={colorVar("chart5")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>团队分布</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-3">
            <SegmentBar total={Math.max(derived.teamCount, 1)} segments={derived.teamSegments} />
            <CompareColumns items={derived.compareColumns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>运营压强</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={BriefcaseBusiness}
              label="未覆盖"
              value={formatCount(derived.uncoveredCount)}
              meta={`占客户 ${formatPercent(derived.uncoveredRatio)}`}
              ratio={derived.uncoveredCount / derived.customerWorkBase}
              color={colorVar("chart5")}
            />
            <MetricCard
              icon={ClipboardCheck}
              label="脚本目录"
              value={formatCount(data.script_count)}
              meta={`当前可见脚本总量`}
              ratio={derived.teamCount > 0 ? data.script_count / Math.max(data.script_count, derived.teamCount) : 0}
              color={colorVar("chart1")}
            />
            <MetricCard
              icon={BadgeDollarSign}
              label="累计批准"
              value={formatCurrency(data.approved_amount_total)}
              meta={`月度占比 ${formatPercent(data.approved_amount_month / derived.revenueBase)}`}
              ratio={data.approved_amount_total / derived.revenueBase}
              color={colorVar("chart3")}
            />
            <MetricCard
              icon={ShieldUser}
              label="管理员"
              value={formatCount(data.admin_count)}
              meta={`团队占比 ${derived.teamCount > 0 ? formatPercent(data.admin_count / derived.teamCount) : "0%"}`}
              ratio={derived.teamCount > 0 ? data.admin_count / derived.teamCount : 0}
              color={colorVar("chart3")}
            />
            <MetricCard
              icon={UserRoundCog}
              label="处理强度"
              value={formatPercent(derived.pressureRatio)}
              meta={`待审与未覆盖取高值`}
              ratio={derived.pressureRatio}
              color={derived.pressureRatio >= 0.3 ? colorVar("danger") : colorVar("chart4")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
