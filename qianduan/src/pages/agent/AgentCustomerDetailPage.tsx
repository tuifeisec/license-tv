import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, FileText, Phone, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getAgentCustomer, updateAgentCustomer } from "@/api/agent/customers";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { Subscription } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function buildRequestPath(customerID: string, tvUsername: string, contact: string, remark: string) {
  const params = new URLSearchParams();
  params.set("customer_id", customerID);
  params.set("tv_username", tvUsername);
  if (contact) {
    params.set("contact", contact);
  }
  if (remark) {
    params.set("remark", remark);
  }
  return `/agent/requests/new?${params.toString()}`;
}

function DetailSummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export function AgentCustomerDetailPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ contact: "", remark: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const query = useQuery({
    queryKey: ["agent-customer", id],
    queryFn: () => getAgentCustomer(id),
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

  const summary = useMemo(() => {
    const activeCount = subscriptions.filter((item) => item.status === "active").length;
    const expiredCount = subscriptions.filter((item) => item.status === "expired").length;
    const revokedCount = subscriptions.filter((item) => item.status === "revoked").length;
    return {
      activeCount,
      expiredCount,
      revokedCount,
    };
  }, [subscriptions]);

  const mutation = useMutation({
    mutationFn: () => updateAgentCustomer(id, form),
    onSuccess: () => {
      notify({ title: "客户信息已更新", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["agent-customer", id] });
      queryClient.invalidateQueries({ queryKey: ["agent-customers"] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const detail = query.data!;
  const detailCustomer = detail.customer;
  const columns: TableColumn<Subscription>[] = [
    { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
    { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
    { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
    { key: "expire", header: "到期时间", render: (item) => formatDateTime(item.expires_at) },
  ];

  const requestPath = buildRequestPath(id, detailCustomer.tv_username, form.contact, form.remark);
  const hasContact = hasText(form.contact);
  const hasRemark = hasText(form.remark);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`客户详情 · ${detailCustomer.tv_username}`}
        description="维护资料并查看订阅记录。"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(requestPath)}>
              <ClipboardCheck className="size-4" />
              发起申请
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "保存中..." : "保存修改"}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailSummaryCard icon={UserRound} label="联系方式" value={hasContact ? "已补齐" : "待补充"} />
        <DetailSummaryCard icon={FileText} label="备注" value={hasRemark ? "已记录" : "待补充"} />
        <DetailSummaryCard icon={ClipboardCheck} label="活跃订阅" value={summary.activeCount} />
        <DetailSummaryCard icon={Phone} label="订阅总数" value={subscriptions.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>客户资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{detailCustomer.tv_username}</Badge>
              <Badge variant={hasContact && hasRemark ? "success" : hasContact || hasRemark ? "warning" : "outline"}>
                {hasContact && hasRemark ? "资料完整" : hasContact || hasRemark ? "待补资料" : "待完善"}
              </Badge>
            </div>

            <PropertyRow label="TV 用户名" value={detailCustomer.tv_username} />
            <PropertyRow label="创建时间" value={formatDateTime(detailCustomer.created_at)} />
            <PropertyRow label="最近更新时间" value={formatDateTime(detailCustomer.updated_at)} />

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">联系方式</label>
              <Input
                value={form.contact}
                onChange={(event) => setForm((state) => ({ ...state, contact: event.target.value }))}
                placeholder="wechat / telegram / email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">备注</label>
              <Textarea
                value={form.remark}
                onChange={(event) => setForm((state) => ({ ...state, remark: event.target.value }))}
                placeholder="来源、意向、付款进度"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle>订阅列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-3">
            {subscriptions.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                message="当前没有订阅记录。"
                action="发起申请"
                onAction={() => navigate(requestPath)}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">活跃 {summary.activeCount}</Badge>
                  <Badge variant="outline">过期 {summary.expiredCount}</Badge>
                  <Badge variant="destructive">已回收 {summary.revokedCount}</Badge>
                </div>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
