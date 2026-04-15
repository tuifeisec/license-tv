import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, RefreshCcw, RotateCcw, ShieldCheck, ShieldOff, Shapes } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { listScripts, syncScripts, updateScript } from "@/api/scripts";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { ScriptStatusToggle } from "@/components/ScriptStatusToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDateTime, relativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { notify } from "@/store/ui-store";
import type { Script } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { value: "all", label: "全部脚本" },
  { value: "enabled", label: "启用中" },
  { value: "disabled", label: "已停用" },
] as const;

type StatusFilterValue = (typeof STATUS_FILTERS)[number]["value"];

function getSyncHealth(input?: string | null) {
  if (!input) {
    return {
      label: "从未同步",
      description: "还没有同步记录",
      tone: "destructive" as const,
    };
  }

  const time = new Date(input);
  if (Number.isNaN(time.getTime())) {
    return {
      label: "同步异常",
      description: "同步时间不可识别",
      tone: "destructive" as const,
    };
  }

  const diffHours = (Date.now() - time.getTime()) / 3_600_000;
  if (diffHours <= 24) {
    return {
      label: "同步正常",
      description: relativeTime(time),
      tone: "success" as const,
    };
  }

  return {
    label: "待同步",
    description: `${Math.floor(diffHours)} 小时未更新`,
    tone: "warning" as const,
  };
}

function PackageSummary({ item }: { item: Script }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{formatCurrency(item.monthly_price)} / 月</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>季 {formatCurrency(item.quarterly_price)}</span>
        <span>年 {formatCurrency(item.yearly_price)}</span>
        <span>永久 {formatCurrency(item.lifetime_price)}</span>
      </div>
      <div className="text-xs text-muted-foreground">试用 {item.trial_days} 天</div>
    </div>
  );
}

export function ScriptListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");

  const canSyncScripts = user?.role === "admin" || user?.role === "super_admin";

  const query = useQuery({
    queryKey: ["scripts", page, pageSize, keyword, statusFilter],
    queryFn: () =>
      listScripts({
        page,
        keyword: keyword.trim() || undefined,
        page_size: pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const syncMutation = useMutation({
    mutationFn: syncScripts,
    onSuccess: (result) => {
      notify({
        title: "同步完成",
        description: `本次同步脚本 ${result.synced} 个。`,
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) => updateScript(String(id), { status }),
    onSuccess: (_, variables) => {
      notify({
        title: variables.status === 1 ? "脚本已启用" : "脚本已停用",
        description: variables.status === 1 ? "该脚本可以继续用于新授权和续费。" : "该脚本已停止新的授权和续费。",
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      queryClient.invalidateQueries({ queryKey: ["script", String(variables.id)] });
      queryClient.invalidateQueries({ queryKey: ["script-options"] });
    },
    onError: () => {
      notify({
        title: "状态切换失败",
        description: "脚本状态未更新，请稍后重试。",
        tone: "destructive",
      });
    },
  });

  const filteredLabel = useMemo(
    () => STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? "全部脚本",
    [statusFilter],
  );

  const columns: TableColumn<Script>[] = [
    {
      key: "script",
      header: "脚本",
      render: (item) => (
        <div className="space-y-1">
          <div className="font-medium">{item.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{item.pine_id}</div>
          <div className="text-xs text-muted-foreground">
            {item.kind || "未识别类型"}
            {item.version ? ` / ${item.version}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "package",
      header: "套餐结构",
      render: (item) => <PackageSummary item={item} />,
    },
    {
      key: "status",
      header: "状态",
      render: (item) => (
        <div className="space-y-1">
          <StatusBadge status={item.status === 1 ? "active" : "disabled"} />
          <div className="text-xs text-muted-foreground">{item.status === 1 ? "允许新授权" : "仅保留存量到期"}</div>
        </div>
      ),
    },
    {
      key: "sync",
      header: "同步健康度",
      render: (item) => {
        const syncHealth = getSyncHealth(item.synced_at);

        return (
          <div className="space-y-1">
            <Badge variant={syncHealth.tone}>{syncHealth.label}</Badge>
            <div className="text-xs text-muted-foreground">{syncHealth.description}</div>
            {item.synced_at ? <div className="text-xs text-muted-foreground">{formatDateTime(item.synced_at)}</div> : null}
          </div>
        );
      },
    },
    {
      key: "action",
      header: "操作",
      className: "w-[180px]",
      render: (item) => {
        const pending = toggleMutation.isPending && toggleMutation.variables?.id === item.id;

        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <ScriptStatusToggle
              checked={item.status === 1}
              pending={pending}
              onCheckedChange={(checked) =>
                toggleMutation.mutate({
                  id: item.id,
                  status: checked ? 1 : 0,
                })
              }
            />
          </div>
        );
      },
    },
  ];

  const mobileRender = (item: Script) => {
    const syncHealth = getSyncHealth(item.synced_at);
    const pending = toggleMutation.isPending && toggleMutation.variables?.id === item.id;

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="font-medium">{item.name}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{item.pine_id}</div>
            <div className="text-xs text-muted-foreground">
              {item.kind || "未识别类型"}
              {item.version ? ` / ${item.version}` : ""}
            </div>
          </div>
          <StatusBadge status={item.status === 1 ? "active" : "disabled"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">套餐结构</div>
            <PackageSummary item={item} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">同步健康度</div>
            <div className="space-y-1">
              <Badge variant={syncHealth.tone}>{syncHealth.label}</Badge>
              <div className="text-xs text-muted-foreground">{syncHealth.description}</div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="text-xs text-muted-foreground">停用仅阻止新授权，存量会自然到期</div>
          <ScriptStatusToggle
            checked={item.status === 1}
            pending={pending}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({
                id: item.id,
                status: checked ? 1 : 0,
              })
            }
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="脚本列表"
        description="维护 TradingView 可授权脚本，优先关注启用状态、同步健康度和套餐结构。"
        actions={
          canSyncScripts ? (
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCcw className="size-4" />
              {syncMutation.isPending ? "同步中..." : "同步脚本"}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between gap-3 py-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Current Scope</div>
              <div className="text-lg font-semibold">{filteredLabel}</div>
              <p className="text-sm text-muted-foreground">当前筛选下共有 {query.data?.total ?? 0} 个脚本。</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-primary shadow-sm">
              <Shapes className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-3 py-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Enable Rule</div>
              <div className="text-lg font-semibold">启用只影响新增</div>
              <p className="text-sm text-muted-foreground">停用后会阻止新增授权与续费，现有存量继续自然到期。</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-warning shadow-sm">
              <ShieldOff className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-3 py-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sync Watch</div>
              <div className="text-lg font-semibold">优先关注待同步脚本</div>
              <p className="text-sm text-muted-foreground">超过 24 小时未同步或从未同步的脚本，建议优先核查。</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-info shadow-sm">
              <Clock3 className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "ring-focus inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    statusFilter === item.value
                      ? "border-border bg-accent text-accent-foreground"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  onClick={() => {
                    setStatusFilter(item.value);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder="按脚本名称或 Pine ID 搜索"
                className="sm:w-72"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setKeyword("");
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                <RotateCcw className="size-4" />
                重置
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full px-2.5 py-1">
              <ShieldCheck className="mr-1 size-3.5" />
              启用脚本支持新授权
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-1">
              <ShieldOff className="mr-1 size-3.5" />
              停用脚本仅保留存量
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-1">
              <Clock3 className="mr-1 size-3.5" />
              待同步脚本需要优先复核
            </Badge>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <DataTable
              data={query.data?.list ?? []}
              columns={columns}
              keyExtractor={(item) => item.id}
              mobileRender={mobileRender}
              empty={<EmptyState icon={RefreshCcw} message="还没有脚本数据，可以先执行一次同步。" />}
              onRowClick={(item) => navigate(`/scripts/${item.id}`)}
            />
            <PaginationBar
              page={query.data?.page ?? page}
              totalPages={totalPages}
              total={query.data?.total ?? 0}
              pageSize={query.data?.page_size ?? pageSize}
              fetching={query.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
