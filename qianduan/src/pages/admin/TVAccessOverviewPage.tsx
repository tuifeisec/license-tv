import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  Unplug,
  UserRoundX,
  Users,
} from "lucide-react";

import { getTVAccessOverview, syncTVAccessSnapshot } from "@/api/system";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getTVAccessRemainingLabel, renderTVAccessStateBadge } from "@/lib/tv-access";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { TVAccessOverviewRow } from "@/types/api";

type AccessFilter = "all" | "active" | "expiring" | "expired" | "permanent";
type ReconcileFilter =
  | "all"
  | "matched_active"
  | "no_customer"
  | "no_subscription"
  | "db_inactive"
  | "grant_flag_mismatch";

const DEFAULT_PAGE_SIZE = 10;

function renderReconcileBadge(status: TVAccessOverviewRow["reconcile_status"]) {
  switch (status) {
    case "matched_active":
      return <Badge variant="success">库内正常</Badge>;
    case "no_customer":
      return <Badge variant="destructive">库内无客户</Badge>;
    case "no_subscription":
      return <Badge variant="warning">库内无订阅</Badge>;
    case "db_inactive":
      return <Badge variant="destructive">订阅非活跃</Badge>;
    case "grant_flag_mismatch":
      return <Badge variant="warning">授权标记异常</Badge>;
  }
}

export function TVAccessOverviewPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [accessStatus, setAccessStatus] = useState<AccessFilter>("all");
  const [reconcileStatus, setReconcileStatus] = useState<ReconcileFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const query = useQuery({
    queryKey: ["tv-access-overview", keyword, accessStatus, reconcileStatus, page, pageSize],
    queryFn: () =>
      getTVAccessOverview({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        access_status: accessStatus === "all" ? undefined : accessStatus,
        reconcile_status: reconcileStatus === "all" ? undefined : reconcileStatus,
      }),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncTVAccessSnapshot(),
    onSuccess: (result) => {
      notify({
        title: "TV 授权快照已同步",
        description: `脚本 ${result.script_count} 个，新增 ${result.inserted_count}，移除 ${result.removed_count}。`,
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["tv-access-overview"] });
    },
  });

  const summary = query.data?.summary;
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const columns: TableColumn<TVAccessOverviewRow>[] = [
    {
      key: "username",
      header: "TV 用户",
      render: (item) => (
        <div>
          <p className="font-medium">{item.username}</p>
          <p className="font-mono text-xs text-muted-foreground">UID: {item.tv_user_id}</p>
        </div>
      ),
    },
    {
      key: "script",
      header: "脚本",
      render: (item) => item.script_name,
    },
    {
      key: "access",
      header: "TV 状态",
      render: (item) => renderTVAccessStateBadge(item.access_status),
    },
    {
      key: "reconcile",
      header: "对账状态",
      render: (item) => renderReconcileBadge(item.reconcile_status),
    },
    {
      key: "subscription",
      header: "库内订阅",
      render: (item) => item.subscription_status || "无记录",
    },
    {
      key: "expiration",
      header: "TV 到期时间",
      render: (item) => formatDateTime(item.tv_expiration),
    },
    {
      key: "remaining",
      header: "剩余时间",
      render: (item) => getTVAccessRemainingLabel({ expiration: item.tv_expiration }),
    },
    {
      key: "customer",
      header: "客户 / 代理",
      className: "hidden xl:table-cell",
      render: (item) =>
        item.customer_id ? (
          <div className="text-xs">
            <p>客户 #{item.customer_id}</p>
            <p className="text-muted-foreground">代理 #{item.agent_id ?? "未关联"}</p>
          </div>
        ) : (
          "未关联"
        ),
    },
  ];

  const exportCurrentPage = () => {
    const rows = query.data?.list ?? [];
    if (rows.length === 0) {
      notify({ title: "没有可导出的记录", tone: "warning" });
      return;
    }

    const header = [
      "tv_username",
      "script_name",
      "access_status",
      "reconcile_status",
      "subscription_status",
      "tv_expiration",
      "customer_id",
      "agent_id",
    ];

    const lines = rows.map((row) =>
      [
        row.username,
        row.script_name,
        row.access_status,
        row.reconcile_status,
        row.subscription_status ?? "",
        row.tv_expiration ?? "",
        row.customer_id ?? "",
        row.agent_id ?? "",
      ]
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(","),
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tv-access-overview-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const metrics = useMemo(
    () => [
      { label: "授权记录总数", value: summary?.total_records ?? 0, icon: Users },
      { label: "唯一用户名数", value: summary?.unique_user_count ?? 0, icon: ShieldCheck },
      { label: "库内正常", value: summary?.matched_active_count ?? 0, icon: ShieldCheck },
      { label: "库内无客户", value: summary?.no_customer_count ?? 0, icon: UserRoundX },
      { label: "库内无订阅", value: summary?.no_subscription_count ?? 0, icon: Unplug },
      { label: "订阅非活跃", value: summary?.db_inactive_count ?? 0, icon: ShieldX },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="TV 授权总表"
        description="统一查看 TV 实际授权名单，并联查库内客户与订阅状态，适合做日常对账和异常排查。"
        actions={
          <>
            <Button variant="outline" onClick={exportCurrentPage}>
              <Download className="size-4" />
              导出当前页
            </Button>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCcw className="size-4" />
              {syncMutation.isPending ? "同步中..." : "同步本地快照"}
            </Button>
            <Button onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCcw className="size-4" />
              {query.isFetching ? "刷新中..." : "刷新总表"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map((item) => (
          <Card key={item.label}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-2.5 text-primary">
                  <item.icon className="size-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 py-4 lg:grid-cols-[1fr_220px_240px]">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="按 TV 用户名或脚本名称搜索"
          />
          <Select
            value={accessStatus}
            onChange={(event) => {
              setAccessStatus(event.target.value as AccessFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部 TV 状态" },
              { value: "active", label: "生效中" },
              { value: "expiring", label: "7 天内到期" },
              { value: "expired", label: "已过期" },
              { value: "permanent", label: "长期有效" },
            ]}
          />
          <Select
            value={reconcileStatus}
            onChange={(event) => {
              setReconcileStatus(event.target.value as ReconcileFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部对账状态" },
              { value: "matched_active", label: "库内正常" },
              { value: "no_customer", label: "库内无客户" },
              { value: "no_subscription", label: "库内无订阅" },
              { value: "db_inactive", label: "订阅非活跃" },
              { value: "grant_flag_mismatch", label: "授权标记异常" },
            ]}
          />
        </CardContent>
      </Card>

      {(summary?.error_script_count ?? 0) > 0 ? (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-4" />
              部分脚本授权名单抓取失败
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              当前共有 {summary?.error_script_count ?? 0} 个脚本未能成功拉取 TV 授权名单，这些脚本不会出现在本次对账结果中。
            </p>
            <div className="flex flex-wrap gap-2">
              {(query.data?.error_scripts ?? []).map((item) => (
                <span
                  key={item.script_id}
                  className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs text-warning"
                >
                  {item.script_name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>授权明细</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading ? (
            <div className="rounded-lg border border-border/70 bg-background/50 px-4 py-8 text-sm text-muted-foreground">
              正在从后端加载 TV 授权总表，请稍候...
            </div>
          ) : (
            <DataTable
              data={query.data?.list ?? []}
              columns={columns}
              keyExtractor={(item) => `${item.script_id}-${item.tv_user_id}-${item.username}`}
              empty={<EmptyState icon={Users} message="当前筛选条件下没有匹配的 TV 授权记录。" />}
            />
          )}

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
    </div>
  );
}
