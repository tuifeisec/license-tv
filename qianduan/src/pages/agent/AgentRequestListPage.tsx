import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { listAgentRequests } from "@/api/agent/requests";
import { listAgentScripts } from "@/api/agent/scripts";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PaymentProofStatusBadge } from "@/components/PaymentProofStatusBadge";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { AccessRequest } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

export function AgentRequestListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState("");
  const [scriptId, setScriptId] = useState("");

  const query = useQuery({
    queryKey: ["agent-requests", page, pageSize, status, scriptId],
    queryFn: () => listAgentRequests({ page, status, script_id: scriptId, page_size: pageSize }),
  });
  const scriptsQuery = useQuery({
    queryKey: ["agent-script-options"],
    queryFn: () => listAgentScripts({ page_size: 100 }),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const columns: TableColumn<AccessRequest>[] = [
    { key: "no", header: "申请编号", render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.request_no}</span> },
    { key: "customer", header: "客户", render: (item) => item.customer?.tv_username ?? "—" },
    { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
    { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
    { key: "amount", header: "金额", render: (item) => formatCurrency(item.amount) },
    { key: "proof", header: "凭证", render: (item) => <PaymentProofStatusBadge value={item.payment_proof} /> },
    { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
    { key: "created", header: "提交时间", render: (item) => formatDateTime(item.created_at) },
    {
      key: "actions",
      header: "操作",
      render: (item) => (
        <Button
          size="xs"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/agent/requests/${item.id}`);
          }}
        >
          申请详情
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="申请记录"
        description="集中跟踪自己的申请状态，并快速识别是否已经上传付款凭证。"
        actions={
          <Button onClick={() => navigate("/agent/requests/new")}>
            <PlusCircle className="size-4" />
            提交申请
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-2">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={[
              { value: "pending", label: "待审核" },
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
            }}
            options={scriptsQuery.data?.list.map((item) => ({ value: String(item.id), label: item.name })) ?? []}
            placeholder="脚本筛选"
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
              empty={<EmptyState icon={ClipboardCheck} message="还没有申请记录，先提交第一笔申请吧。" />}
              onRowClick={(item) => navigate(`/agent/requests/${item.id}`)}
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
