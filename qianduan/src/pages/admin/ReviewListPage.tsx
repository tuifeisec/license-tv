import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { approveReview, batchApproveReviews, listReviews, rejectReview } from "@/api/reviews";
import { listScripts } from "@/api/scripts";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PaymentProofStatusBadge } from "@/components/PaymentProofStatusBadge";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { RejectDialog } from "@/components/RejectDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { AccessRequest } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

export function ReviewListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["reviews", page, pageSize, status, scriptId],
    queryFn: () => listReviews({ page, status, script_id: scriptId, page_size: pageSize }),
  });
  const scriptsQuery = useQuery({
    queryKey: ["review-script-options"],
    queryFn: () => listScripts({ page_size: 100 }),
  });

  const totalPages = Math.max(1, Math.ceil((reviewsQuery.data?.total ?? 0) / (reviewsQuery.data?.page_size ?? pageSize)));

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveReview(id),
    onSuccess: () => {
      notify({ title: "审核通过成功", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectReview(id, { reason }),
    onSuccess: () => {
      notify({ title: "申请已拒绝", tone: "warning" });
      setRejecting(null);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
  const batchMutation = useMutation({
    mutationFn: () => batchApproveReviews({ ids: selectedIds }),
    onSuccess: (result) => {
      notify({ title: "批量审核完成", description: `通过 ${result.success_ids.length} 项。`, tone: "success" });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  const scriptOptions = useMemo(
    () =>
      scriptsQuery.data?.list.map((item) => ({
        value: String(item.id),
        label: item.name,
      })) ?? [],
    [scriptsQuery.data],
  );

  const columns: TableColumn<AccessRequest>[] = [
    {
      key: "select",
      header: "",
      render: (item) =>
        item.status === "pending" ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={(event) =>
              setSelectedIds((state) =>
                event.target.checked ? [...state, item.id] : state.filter((value) => value !== item.id),
              )
            }
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "no", header: "申请编号", render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.request_no}</span> },
    { key: "customer", header: "客户", render: (item) => item.customer?.tv_username ?? "—" },
    { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
    { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
    { key: "amount", header: "金额", render: (item) => formatCurrency(item.amount) },
    { key: "proof", header: "凭证", render: (item) => <PaymentProofStatusBadge value={item.payment_proof} /> },
    { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
    { key: "time", header: "提交时间", className: "hidden xl:table-cell", render: (item) => formatDateTime(item.created_at) },
    {
      key: "actions",
      header: "操作",
      render: (item) =>
        item.status === "pending" ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                approveMutation.mutate(item.id);
              }}
            >
              通过
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                setRejecting(item);
              }}
            >
              拒绝
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {item.status === "approved" ? "已审核通过" : item.status === "rejected" ? "已审核拒绝" : "无需操作"}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="审核列表"
        description="集中处理代理提交的申请，并优先识别缺少付款凭证的记录。"
        actions={
          <Button onClick={() => batchMutation.mutate()} disabled={selectedIds.length === 0 || batchMutation.isPending}>
            {batchMutation.isPending ? "处理中..." : `批量通过 (${selectedIds.length})`}
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
              setSelectedIds([]);
            }}
            options={[
              { value: "pending", label: "待处理" },
              { value: "approved", label: "已通过" },
              { value: "rejected", label: "已拒绝" },
              { value: "cancelled", label: "已取消" },
            ]}
            placeholder="状态筛选"
          />
          <Select
            value={scriptId}
            onChange={(event) => {
              setScriptId(event.target.value);
              setPage(1);
              setSelectedIds([]);
            }}
            options={scriptOptions}
            placeholder="脚本筛选"
          />
          <Input value={selectedIds.join(", ")} readOnly placeholder="当前批量选择的 ID 会显示在这里" />
        </CardContent>
      </Card>

      {reviewsQuery.isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <DataTable
              data={reviewsQuery.data?.list ?? []}
              columns={columns}
              keyExtractor={(item) => item.id}
              empty={<EmptyState icon={Inbox} message="暂无审核申请数据。" />}
              onRowClick={(item) => navigate(`/reviews/${item.id}`)}
            />
            <PaginationBar
              page={reviewsQuery.data?.page ?? page}
              totalPages={totalPages}
              total={reviewsQuery.data?.total ?? 0}
              pageSize={reviewsQuery.data?.page_size ?? pageSize}
              fetching={reviewsQuery.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
                setSelectedIds([]);
              }}
            />
          </CardContent>
        </Card>
      )}

      <RejectDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => rejecting && rejectMutation.mutate({ id: rejecting.id, reason })}
        pending={rejectMutation.isPending}
      />
    </div>
  );
}
