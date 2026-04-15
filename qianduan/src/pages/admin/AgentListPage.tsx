import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownWideNarrow, Eye, KeyRound, RotateCcw, ShieldUser } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createAgent, listAgents, resetAgentPassword, updateAgent } from "@/api/agents";
import { AgentPasswordResetDialog } from "@/components/AgentPasswordResetDialog";
import { AgentQuickViewPanel } from "@/components/AgentQuickViewPanel";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { AgentDetail } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_FORM = {
  username: "",
  password: "",
  display_name: "",
  commission_rate: "0.15",
  status: "1",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "enabled", label: "仅启用" },
  { value: "disabled", label: "仅禁用" },
];

const PERFORMANCE_FILTER_OPTIONS = [
  { value: "all", label: "全部代理" },
  { value: "with_customers", label: "有客户" },
  { value: "with_active_subscriptions", label: "有活跃订阅" },
  { value: "with_approved_requests", label: "有批准流水" },
];

const SORT_BY_OPTIONS = [
  { value: "approved_amount_total", label: "累计批准金额" },
  { value: "active_subscription_count", label: "活跃订阅数" },
  { value: "customer_count", label: "客户数" },
  { value: "created_at", label: "创建时间" },
];

const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "从高到低" },
  { value: "asc", label: "从低到高" },
];

function getStatusLabel(status?: number) {
  return status === 1 ? "启用" : "禁用";
}

function getAgentHealthHint(item: AgentDetail) {
  if ((item.customer_count ?? 0) === 0) {
    return "待分配客户";
  }
  if ((item.active_subscription_count ?? 0) === 0) {
    return "待转化";
  }
  return "转化中";
}

export function AgentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("approved_amount_total");
  const [sortOrder, setSortOrder] = useState("desc");
  const [editing, setEditing] = useState<AgentDetail | null>(null);
  const [resetting, setResetting] = useState<AgentDetail | null>(null);
  const [quickViewing, setQuickViewing] = useState<AgentDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const query = useQuery({
    queryKey: ["agents", page, pageSize, keyword, statusFilter, performanceFilter, sortBy, sortOrder],
    queryFn: () =>
      listAgents({
        page,
        page_size: pageSize,
        keyword: keyword.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        performance: performanceFilter === "all" ? undefined : performanceFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const openCreateDialog = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  };

  const openEditDialog = (item: AgentDetail) => {
    setQuickViewing(null);
    setEditing(item);
    setForm({
      username: item.username,
      password: "",
      display_name: item.display_name ?? "",
      commission_rate: String(item.commission_rate ?? 0),
      status: String(item.status ?? 1),
    });
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createAgent({
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        commission_rate: Number(form.commission_rate),
        status: Number(form.status),
      }),
    onSuccess: () => {
      notify({ title: "代理创建成功", tone: "success" });
      setOpen(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateAgent(editing.id, {
            display_name: form.display_name.trim(),
            commission_rate: Number(form.commission_rate),
            status: Number(form.status),
          })
        : Promise.resolve(null),
    onSuccess: () => {
      notify({ title: "代理信息已更新", tone: "success" });
      setOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      resetAgentPassword(id, { new_password: newPassword }),
    onSuccess: () => {
      notify({ title: "代理密码已重置", tone: "success" });
      setResetting(null);
    },
  });

  const columns: TableColumn<AgentDetail>[] = [
    { key: "username", header: "用户名", render: (item) => <span className="font-medium">{item.username}</span> },
    { key: "name", header: "显示名称", render: (item) => item.display_name || "未设置" },
    { key: "rate", header: "佣金比例", render: (item) => `${((item.commission_rate ?? 0) * 100).toFixed(1)}%` },
    { key: "customers", header: "客户数", render: (item) => item.customer_count ?? 0 },
    { key: "subscriptions", header: "活跃订阅", render: (item) => item.active_subscription_count ?? 0 },
    { key: "amount", header: "累计批准金额", render: (item) => formatCurrency(item.approved_amount_total ?? 0) },
    {
      key: "status",
      header: "状态",
      render: (item) => (
        <div className="space-y-1">
          <div className="font-medium">{getStatusLabel(item.status)}</div>
          <div className="text-xs text-muted-foreground">{getAgentHealthHint(item)}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "操作",
      className: "w-[240px]",
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              setQuickViewing(item);
            }}
          >
            <Eye className="size-3.5" />
            速览
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              openEditDialog(item);
            }}
          >
            编辑
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              setResetting(item);
            }}
          >
            <KeyRound className="size-3.5" />
            重置密码
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="代理列表" actions={<Button onClick={openCreateDialog}>新建代理</Button>} />

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-[minmax(0,1.5fr)_160px_190px_190px_150px_auto]">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="按用户名或显示名称搜索代理"
          />
          <Select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            options={STATUS_FILTER_OPTIONS}
          />
          <Select
            value={performanceFilter}
            onChange={(event) => {
              setPerformanceFilter(event.target.value);
              setPage(1);
            }}
            options={PERFORMANCE_FILTER_OPTIONS}
          />
          <Select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
            options={SORT_BY_OPTIONS}
          />
          <Select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setPage(1);
            }}
            options={SORT_ORDER_OPTIONS}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setKeyword("");
              setStatusFilter("all");
              setPerformanceFilter("all");
              setSortBy("approved_amount_total");
              setSortOrder("desc");
              setPage(1);
            }}
          >
            <RotateCcw className="size-4" />
            重置
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-background/40">
        <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
          <ArrowDownWideNarrow className="size-4" />
          <span>当前排序</span>
          <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-foreground">
            {SORT_BY_OPTIONS.find((item) => item.value === sortBy)?.label}
          </span>
          <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-foreground">
            {SORT_ORDER_OPTIONS.find((item) => item.value === sortOrder)?.label}
          </span>
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
              empty={<EmptyState icon={ShieldUser} message="暂时还没有代理账号，可以先创建一位代理。" />}
              onRowClick={(item) => navigate(`/agents/${item.id}`)}
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

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "编辑代理" : "新建代理"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            value={form.username}
            onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
            placeholder="用户名"
            disabled={Boolean(editing)}
          />
          {!editing ? (
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
              placeholder="初始密码，至少 6 位"
            />
          ) : null}
          <Input
            value={form.display_name}
            onChange={(event) => setForm((state) => ({ ...state, display_name: event.target.value }))}
            placeholder="显示名称"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={form.commission_rate}
            onChange={(event) => setForm((state) => ({ ...state, commission_rate: event.target.value }))}
            placeholder="佣金比例，范围 0 到 1"
          />
          <Select
            value={form.status}
            onChange={(event) => setForm((state) => ({ ...state, status: event.target.value }))}
            options={[
              { value: "1", label: "启用" },
              { value: "0", label: "禁用" },
            ]}
          />
        </div>
      </Dialog>

      <AgentPasswordResetDialog
        open={Boolean(resetting)}
        agent={resetting}
        pending={resetPasswordMutation.isPending}
        onClose={() => setResetting(null)}
        onSubmit={(newPassword) => resetting && resetPasswordMutation.mutate({ id: resetting.id, newPassword })}
      />

      <AgentQuickViewPanel
        agent={quickViewing}
        open={Boolean(quickViewing)}
        onClose={() => setQuickViewing(null)}
        onEdit={openEditDialog}
        onResetPassword={(agent) => {
          setQuickViewing(null);
          setResetting(agent);
        }}
        onOpenDetail={(agent) => {
          setQuickViewing(null);
          navigate(`/agents/${agent.id}`);
        }}
      />
    </div>
  );
}
