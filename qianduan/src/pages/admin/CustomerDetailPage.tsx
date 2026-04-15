import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getCustomer, updateCustomer } from "@/api/customers";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { Subscription } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ contact: "", remark: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
  });

  useEffect(() => {
    if (query.data) {
      setForm({
        contact: query.data.customer.contact ?? "",
        remark: query.data.customer.remark ?? "",
      });
    }
  }, [query.data]);

  const subscriptions = query.data?.subscriptions ?? [];
  const totalPages = Math.max(1, Math.ceil(subscriptions.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedSubscriptions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return subscriptions.slice(start, start + pageSize);
  }, [page, pageSize, subscriptions]);

  const mutation = useMutation({
    mutationFn: () => updateCustomer(id, form),
    onSuccess: () => {
      notify({ title: "客户信息已更新", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const detail = query.data!;
  const columns: TableColumn<Subscription>[] = [
    { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
    { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
    { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
    { key: "expire", header: "到期时间", render: (item) => formatDateTime(item.expires_at) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`客户详情 · ${detail.customer.tv_username}`}
        description="这里展示客户基本资料以及其历史订阅记录。"
        actions={
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "保存中..." : "保存客户信息"}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>客户资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PropertyRow label="TV 用户名" value={detail.customer.tv_username} />
            <PropertyRow label="TV 用户 ID" value={detail.customer.tv_user_id ?? "—"} />
            <PropertyRow label="创建时间" value={formatDateTime(detail.customer.created_at)} />
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">联系方式</label>
              <Input value={form.contact} onChange={(event) => setForm((state) => ({ ...state, contact: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">备注</label>
              <Textarea value={form.remark} onChange={(event) => setForm((state) => ({ ...state, remark: event.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>订阅列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable data={pagedSubscriptions} columns={columns} keyExtractor={(item) => item.id} />
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={subscriptions.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
