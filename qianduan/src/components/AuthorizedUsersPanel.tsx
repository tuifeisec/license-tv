import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, RefreshCcw, Users } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { getTVAccessRemainingLabel, getTVAccessState, renderTVAccessStateBadge, type TVAccessState } from "@/lib/tv-access";
import { notify } from "@/store/ui-store";
import type { ScriptAuthorizedUser } from "@/types/api";

type UserFilter = "all" | TVAccessState;

const DEFAULT_PAGE_SIZE = 10;

export function AuthorizedUsersPanel({
  users,
  loading,
  refreshing,
  onRefresh,
}: {
  users: ScriptAuthorizedUser[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const stats = useMemo(() => {
    const stateCounts = {
      active: 0,
      expiring: 0,
      expired: 0,
      permanent: 0,
    };

    users.forEach((item) => {
      stateCounts[getTVAccessState(item)] += 1;
    });

    return {
      total: users.length,
      ...stateCounts,
    };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((item) => {
      const matchedKeyword = item.username.toLowerCase().includes(keyword.trim().toLowerCase());
      const matchedFilter = filter === "all" ? true : getTVAccessState(item) === filter;
      return matchedKeyword && matchedFilter;
    });
  }, [filter, keyword, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const columns: TableColumn<ScriptAuthorizedUser>[] = [
    {
      key: "username",
      header: "TV 用户名",
      render: (item) => <span className="font-medium">{item.username}</span>,
    },
    {
      key: "state",
      header: "授权状态",
      render: (item) => renderTVAccessStateBadge(getTVAccessState(item)),
    },
    {
      key: "expiration",
      header: "到期时间",
      render: (item) => formatDateTime(item.expiration),
    },
    {
      key: "remaining",
      header: "剩余时间",
      render: (item) => getTVAccessRemainingLabel(item),
    },
    {
      key: "created",
      header: "创建时间",
      className: "hidden xl:table-cell",
      render: (item) => formatDateTime(item.created),
    },
  ];

  const copyFilteredUsers = async () => {
    const content = filtered.map((item) => item.username).join("\n");
    if (!content) {
      notify({ title: "没有可复制的用户名", tone: "warning" });
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      notify({
        title: "用户名已复制",
        description: `已复制 ${filtered.length} 个用户名，可直接用于外部核对。`,
        tone: "success",
      });
    } catch {
      notify({
        title: "复制失败",
        description: "当前环境不支持直接写入剪贴板，请手动复制。",
        tone: "warning",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <PageHeader
          title="TV 授权用户"
          description="展示 TradingView 实际授权名单，支持按状态筛选和快速复制用户名。"
          actions={
            <>
              <Button variant="outline" onClick={copyFilteredUsers}>
                <Copy className="size-4" />
                复制当前结果
              </Button>
              <Button onClick={onRefresh} disabled={!onRefresh || refreshing}>
                <RefreshCcw className="size-4" />
                {refreshing ? "刷新中..." : "刷新名单"}
              </Button>
            </>
          }
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="bg-background/50">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">总授权用户</p>
              <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">生效中</p>
              <p className="mt-2 text-2xl font-bold">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">7 天内到期</p>
              <p className="mt-2 text-2xl font-bold">{stats.expiring}</p>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">已过期</p>
              <p className="mt-2 text-2xl font-bold">{stats.expired}</p>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">长期有效</p>
              <p className="mt-2 text-2xl font-bold">{stats.permanent}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="按 TV 用户名搜索"
          />
          <Select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as UserFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部状态" },
              { value: "active", label: "生效中" },
              { value: "expiring", label: "7 天内到期" },
              { value: "expired", label: "已过期" },
              { value: "permanent", label: "长期有效" },
            ]}
          />
        </div>

        {stats.expired > 0 || stats.expiring > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">建议巡检即将到期和已过期用户</p>
              <p className="mt-1 text-xs">
                当前共有 {stats.expiring} 个用户将在 7 天内到期，{stats.expired} 个用户已过期。可以结合订阅列表进一步核对。
              </p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-border/70 bg-background/50 px-4 py-8 text-sm text-muted-foreground">
            正在加载 TV 授权名单...
          </div>
        ) : (
          <>
            <DataTable
              data={pagedUsers}
              columns={columns}
              keyExtractor={(item) => item.id}
              empty={<EmptyState icon={Users} message="当前没有匹配的授权用户。" />}
            />
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={pageSize}
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
  );
}
