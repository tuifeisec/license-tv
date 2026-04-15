import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { listCustomers } from "@/api/customers";
import { listScripts } from "@/api/scripts";
import { createSubscription, listSubscriptions, renewSubscription, revokeSubscription } from "@/api/subscriptions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PlanTypeSelect } from "@/components/PlanTypeSelect";
import { ScriptSelect } from "@/components/ScriptSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { SubscriptionRenewDialog } from "@/components/SubscriptionRenewDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { PlanType, Subscription } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

export function SubscriptionListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renewing, setRenewing] = useState<Subscription | null>(null);
  const [revoking, setRevoking] = useState<Subscription | null>(null);
  const [grantForm, setGrantForm] = useState({
    customer_id: "",
    script_id: "",
    plan_type: "monthly" as PlanType,
    requested_days: 0,
  });

  const query = useQuery({
    queryKey: ["subscriptions", page, pageSize, status, scriptId, customerKeyword],
    queryFn: () =>
      listSubscriptions({
        page,
        status,
        script_id: scriptId,
        customer_keyword: customerKeyword,
        page_size: pageSize,
      }),
  });
  const scriptsQuery = useQuery({
    queryKey: ["subscription-script-options"],
    queryFn: () => listScripts({ page_size: 100 }),
  });
  const customersQuery = useQuery({
    queryKey: ["subscription-customer-options"],
    queryFn: () => listCustomers({ page_size: 100 }),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const createMutation = useMutation({
    mutationFn: () =>
      createSubscription({
        customer_id: Number(grantForm.customer_id),
        script_id: Number(grantForm.script_id),
        plan_type: grantForm.plan_type,
        requested_days: Number(grantForm.requested_days || 0),
      }),
    onSuccess: () => {
      notify({ title: "订阅创建成功", tone: "success" });
      setCreateOpen(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
  const renewMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { plan_type: PlanType; requested_days?: number };
    }) => renewSubscription(id, payload),
    onSuccess: () => {
      notify({ title: "订阅续费已生效", tone: "success" });
      setRenewing(null);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeSubscription(id),
    onSuccess: () => {
      notify({ title: "授权已撤销", tone: "warning" });
      setRevoking(null);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  const columns: TableColumn<Subscription>[] = [
    { key: "customer", header: "客户", render: (item) => item.customer?.tv_username ?? "—" },
    { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
    { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
    { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
    { key: "expire", header: "到期时间", render: (item) => formatDateTime(item.expires_at) },
    {
      key: "actions",
      header: "操作",
      render: (item) =>
        item.status === "active" ? (
          <div className="flex justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                setRenewing(item);
              }}
            >
              续费
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                setRevoking(item);
              }}
            >
              撤销授权
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item.status === "expired" ? "已过期" : "已撤销授权"}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="订阅列表"
        description="查看全部客户订阅状态，并支持直接授权、续费和撤销授权。"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusCircle className="size-4" />
            直接授权
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-3">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={[
              { value: "active", label: "生效中" },
              { value: "expired", label: "已过期" },
              { value: "revoked", label: "已撤销" },
            ]}
            placeholder="状态筛选"
          />
          <Select
            value={scriptId}
            onChange={(event) => {
              setScriptId(event.target.value);
              setPage(1);
            }}
            options={scriptsQuery.data?.list.map((item) => ({ value: String(item.id), label: item.name })) ?? []}
            placeholder="脚本筛选"
          />
          <Input
            value={customerKeyword}
            onChange={(event) => {
              setCustomerKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="客户关键词"
          />
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
              empty={<EmptyState icon={PlusCircle} message="当前没有订阅数据，可以直接创建首条授权。" />}
              onRowClick={(item) => navigate(`/subscriptions/${item.id}`)}
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="直接授权"
        description="适用于管理员直接发放订阅，不经过代理审核流程。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "提交中..." : "确认授权"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Select
            value={grantForm.customer_id}
            onChange={(event) => setGrantForm((state) => ({ ...state, customer_id: event.target.value }))}
            options={customersQuery.data?.list.map((item) => ({ value: String(item.id), label: item.tv_username })) ?? []}
            placeholder="选择客户"
          />
          <ScriptSelect
            value={grantForm.script_id}
            onChange={(value) => setGrantForm((state) => ({ ...state, script_id: value }))}
          />
          <PlanTypeSelect
            value={grantForm.plan_type}
            onChange={(value) => setGrantForm((state) => ({ ...state, plan_type: value as PlanType }))}
          />
          <Input
            type="number"
            value={grantForm.requested_days}
            onChange={(event) => setGrantForm((state) => ({ ...state, requested_days: Number(event.target.value) }))}
            placeholder="自定义天数，可留空"
          />
        </div>
      </Dialog>

      <SubscriptionRenewDialog
        open={Boolean(renewing)}
        subscription={renewing}
        onClose={() => setRenewing(null)}
        pending={renewMutation.isPending}
        onSubmit={(payload) => renewing && renewMutation.mutate({ id: renewing.id, payload })}
      />

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revokeMutation.mutate(revoking.id)}
        pending={revokeMutation.isPending}
        title="确认撤销授权"
        description={`撤销后会移除 ${revoking?.customer?.tv_username ?? "该客户"} 在 TradingView 的脚本访问权限，但保留订阅记录用于对账。`}
        confirmText="确认撤销授权"
      />
    </div>
  );
}
