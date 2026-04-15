import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Clock3, Filter, Search, Tags, Wallet } from "lucide-react";

import { listAgentScripts } from "@/api/agent/scripts";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import type { Script } from "@/types/api";

const DEFAULT_PAGE_SIZE = 9;
const PAGE_SIZE_OPTIONS = [9, 18, 27];

const PRICE_PLAN_LABELS = {
  monthly: "月付",
  quarterly: "季付",
  yearly: "年付",
  lifetime: "永久",
} as const;

type SortValue = "default" | "monthly_asc" | "monthly_desc" | "trial_desc" | "lifetime_desc";
type TrialFilter = "all" | "trial_only" | "no_trial";

function getPricePoints(script: Script) {
  return [
    { key: "monthly" as const, label: PRICE_PLAN_LABELS.monthly, price: Number(script.monthly_price ?? 0) },
    { key: "quarterly" as const, label: PRICE_PLAN_LABELS.quarterly, price: Number(script.quarterly_price ?? 0) },
    { key: "yearly" as const, label: PRICE_PLAN_LABELS.yearly, price: Number(script.yearly_price ?? 0) },
    { key: "lifetime" as const, label: PRICE_PLAN_LABELS.lifetime, price: Number(script.lifetime_price ?? 0) },
  ];
}

function getAvailablePricePoints(script: Script) {
  return getPricePoints(script).filter((item) => item.price > 0);
}

function getPriceBand(script: Script) {
  const prices = getAvailablePricePoints(script).map((item) => item.price);
  if (prices.length === 0) {
    return "未定价";
  }
  return `${formatCurrency(Math.min(...prices))} - ${formatCurrency(Math.max(...prices))}`;
}

function getLowestMonthlyPrice(list: Script[]) {
  const monthlyPrices = list.map((item) => item.monthly_price).filter((value) => value > 0);
  return monthlyPrices.length > 0 ? formatCurrency(Math.min(...monthlyPrices)) : "-";
}

function getHighestLifetimePrice(list: Script[]) {
  const lifetimePrices = list.map((item) => item.lifetime_price).filter((value) => value > 0);
  return lifetimePrices.length > 0 ? formatCurrency(Math.max(...lifetimePrices)) : "-";
}

function normalizeScriptText(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getScriptDescription(script: Script) {
  const description = script.description?.trim();
  if (!description) {
    return null;
  }

  const normalizedName = normalizeScriptText(script.name);
  const normalizedDescription = normalizeScriptText(description);

  if (normalizedName && normalizedName === normalizedDescription) {
    return null;
  }

  return description;
}

function sortScripts(list: Script[], sort: SortValue) {
  const next = [...list];
  switch (sort) {
    case "monthly_asc":
      next.sort((a, b) => a.monthly_price - b.monthly_price);
      break;
    case "monthly_desc":
      next.sort((a, b) => b.monthly_price - a.monthly_price);
      break;
    case "trial_desc":
      next.sort((a, b) => b.trial_days - a.trial_days);
      break;
    case "lifetime_desc":
      next.sort((a, b) => b.lifetime_price - a.lifetime_price);
      break;
    default:
      next.sort((a, b) => b.id - a.id);
      break;
  }
  return next;
}

function OverviewChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 px-3 py-2.5">
      <div className="rounded-xl border border-border/70 bg-background/70 p-2 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ScriptCard({ item }: { item: Script }) {
  const pricePoints = getPricePoints(item);
  const availablePlans = getAvailablePricePoints(item);
  const description = getScriptDescription(item);

  return (
    <Card className="h-full overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
      <CardHeader className="gap-3 border-b border-border/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {availablePlans.length > 0 ? <PlanTypeBadge value={availablePlans[0].key} /> : null}
              {item.trial_days > 0 ? <PlanTypeBadge value="trial" /> : null}
            </div>
            <div className="space-y-1">
              <CardTitle className="line-clamp-2 text-base leading-6">{item.name}</CardTitle>
              {description ? <CardDescription className="line-clamp-3 text-sm leading-6">{description}</CardDescription> : null}
            </div>
          </div>

          <Badge variant="outline" className="max-w-[120px] truncate">
            {item.kind || "script"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">价格带 {getPriceBand(item)}</Badge>
          <Badge variant={item.trial_days > 0 ? "warning" : "outline"}>
            {item.trial_days > 0 ? `试用 ${item.trial_days} 天` : "无试用"}
          </Badge>
          {item.version ? <Badge variant="outline">版本 {item.version}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {pricePoints.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                "rounded-2xl border px-3 py-2.5",
                plan.price > 0 ? "border-border/70 bg-background/45" : "border-border/50 bg-background/20 opacity-70",
              )}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{plan.label}</div>
              <div className="mt-1.5 text-sm font-semibold">{plan.price > 0 ? formatCurrency(plan.price) : "未配置"}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentScriptListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<SortValue>("default");
  const [trialFilter, setTrialFilter] = useState<TrialFilter>("all");
  const deferredKeyword = useDeferredValue(keyword);

  const query = useQuery({
    queryKey: ["agent-scripts"],
    queryFn: () => listAgentScripts({ page_size: 100 }),
  });

  const list = query.data?.list ?? [];

  const filteredList = useMemo(() => {
    let next = [...list];
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();

    if (normalizedKeyword) {
      next = next.filter((item) => {
        const name = item.name?.toLowerCase() ?? "";
        const description = item.description?.toLowerCase() ?? "";
        const kind = item.kind?.toLowerCase() ?? "";

        return (
          name.includes(normalizedKeyword) ||
          description.includes(normalizedKeyword) ||
          kind.includes(normalizedKeyword)
        );
      });
    }

    if (trialFilter === "trial_only") {
      next = next.filter((item) => item.trial_days > 0);
    } else if (trialFilter === "no_trial") {
      next = next.filter((item) => item.trial_days <= 0);
    }

    return sortScripts(next, sort);
  }, [deferredKeyword, list, sort, trialFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const hasActiveFilters = keyword.trim().length > 0 || sort !== "default" || trialFilter !== "all";

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = [];

    if (keyword.trim()) {
      badges.push(`关键词：${keyword.trim()}`);
    }

    if (trialFilter === "trial_only") {
      badges.push("仅看可试用");
    } else if (trialFilter === "no_trial") {
      badges.push("仅看无试用");
    }

    if (sort === "monthly_asc") {
      badges.push("月付从低到高");
    } else if (sort === "monthly_desc") {
      badges.push("月付从高到低");
    } else if (sort === "trial_desc") {
      badges.push("试用天数最长");
    } else if (sort === "lifetime_desc") {
      badges.push("永久价格最高");
    }

    return badges;
  }, [keyword, sort, trialFilter]);

  const currentStart = filteredList.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const currentEnd = Math.min(page * pageSize, filteredList.length);

  const resetFilters = () => {
    setKeyword("");
    setTrialFilter("all");
    setSort("default");
    setPage(1);
  };

  if (query.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        message="脚本目录加载失败，请稍后重试。"
        action="重新加载"
        onAction={() => query.refetch()}
      />
    );
  }

  if (!query.data || list.length === 0) {
    return <EmptyState icon={Bot} message="当前没有可售脚本，请等待管理员同步后再查看。" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Script Directory</div>
              <CardTitle className="text-base">脚本目录</CardTitle>
              <CardDescription>集中查看可售脚本、试用状态和价格区间。</CardDescription>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <OverviewChip icon={Bot} label="脚本总数" value={list.length} />
              <OverviewChip icon={Clock3} label="支持试用" value={list.filter((item) => item.trial_days > 0).length} />
              <OverviewChip icon={Wallet} label="最低月付" value={getLowestMonthlyPrice(list)} />
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/70 pt-4 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索脚本名称 / 描述 / 类型"
              />
            </div>

            <Select
              value={trialFilter}
              onChange={(event) => {
                setTrialFilter(event.target.value as TrialFilter);
                setPage(1);
              }}
              options={[
                { value: "all", label: "全部试用状态" },
                { value: "trial_only", label: "仅看可试用" },
                { value: "no_trial", label: "仅看无试用" },
              ]}
            />

            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortValue);
                setPage(1);
              }}
              options={[
                { value: "default", label: "默认排序" },
                { value: "monthly_asc", label: "月付从低到高" },
                { value: "monthly_desc", label: "月付从高到低" },
                { value: "trial_desc", label: "试用天数最长" },
                { value: "lifetime_desc", label: "永久价格最高" },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Badge variant="outline">
                <Filter className="size-3.5" />
                当前 {filteredList.length} 个
              </Badge>
              <Badge variant="outline">
                <Tags className="size-3.5" />
                最高永久价 {getHighestLifetimePrice(list)}
              </Badge>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="cursor-pointer text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  清空筛选
                </button>
              ) : null}
            </div>
          </div>

          {activeFilterBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
              {activeFilterBadges.map((item) => (
                <Badge key={item} variant="outline" className="bg-background/30">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              当前显示第 {currentStart}-{currentEnd} 项，共 {filteredList.length} 个结果
            </span>
            <span>每页 {pageSize} 项</span>
          </div>

          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-background/35 px-6 py-12 text-center">
              <div className="rounded-full border border-border/70 bg-background/60 p-4 text-muted-foreground">
                <Filter className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">没有匹配到脚本</p>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  可以尝试清空关键词、放宽试用条件，或者切回默认排序查看完整目录。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagedList.map((item) => (
                  <ScriptCard key={item.id} item={item} />
                ))}
              </div>

              <PaginationBar
                page={page}
                totalPages={totalPages}
                total={filteredList.length}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(value) => {
                  setPageSize(value);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
