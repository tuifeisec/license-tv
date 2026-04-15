import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, PlusCircle, Users, type LucideIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createAgentCustomer, listAgentCustomers } from "@/api/agent/customers";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { TVUsernameInput } from "@/components/TVUsernameInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getExpiryLevel, isExpiringSoon, type ExpiryLevel } from "@/lib/subscription-expiry";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { Customer, CustomerListItem, PlanType, SubscriptionBrief } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_VISIBLE_SUBSCRIPTIONS = 2;

type MaintenanceFilter = "all" | "missing_contact" | "missing_remark" | "ready";
type BusinessStatusFilter = "all" | "active" | "expiring_soon" | "no_subscription" | "pending";

const planTypeLabelMap: Record<PlanType, string> = {
  monthly: "月付",
  quarterly: "季付",
  yearly: "年付",
  lifetime: "永久",
  trial: "试用",
};

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function buildCustomerRequestPath(customer: Customer) {
  const params = new URLSearchParams();
  params.set("customer_id", String(customer.id));
  params.set("tv_username", customer.tv_username);
  if (customer.contact) {
    params.set("contact", customer.contact);
  }
  if (customer.remark) {
    params.set("remark", customer.remark);
  }
  return `/agent/requests/new?${params.toString()}`;
}

function getMaintenanceState(customer: Customer) {
  const hasContact = hasText(customer.contact);
  const hasRemark = hasText(customer.remark);

  if (!hasContact) {
    return { id: "missing_contact" as const, label: "待补联系方式" };
  }
  if (!hasRemark) {
    return { id: "missing_remark" as const, label: "待补备注" };
  }
  return { id: "ready" as const, label: "资料完整" };
}

function getRequestStatusMeta(customer: CustomerListItem) {
  if (customer.pending_request_count > 0) {
    return {
      label: `待审核 ${customer.pending_request_count}`,
      variant: "warning" as const,
    };
  }

  if (customer.active_subscriptions.length > 0) {
    return {
      label: "已授权",
      variant: "success" as const,
    };
  }

  return {
    label: "可申请",
    variant: "outline" as const,
  };
}

function mapExpiryLevelToVariant(level: ExpiryLevel) {
  switch (level) {
    case "critical":
      return "destructive" as const;
    case "warning":
      return "warning" as const;
    case "lifetime":
      return "outline" as const;
    default:
      return "success" as const;
  }
}

function getSubscriptionSortValue(subscription: SubscriptionBrief) {
  if (subscription.plan_type === "lifetime" || !subscription.expires_at) {
    return Number.MAX_SAFE_INTEGER;
  }

  const time = new Date(subscription.expires_at).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function sortSubscriptions(subscriptions: SubscriptionBrief[]) {
  return [...subscriptions].sort((a, b) => {
    const diff = getSubscriptionSortValue(a) - getSubscriptionSortValue(b);
    if (diff !== 0) {
      return diff;
    }
    return a.script_name.localeCompare(b.script_name);
  });
}

function getNearestExpiringSubscription(subscriptions: SubscriptionBrief[]) {
  return sortSubscriptions(subscriptions).find((item) => item.plan_type !== "lifetime" && item.expires_at);
}

function getExpirySummary(subscriptions: SubscriptionBrief[]) {
  if (subscriptions.length === 0) {
    return {
      primary: "暂无授权",
      secondary: "未形成有效订阅",
      variant: "outline" as const,
    };
  }

  const nearest = getNearestExpiringSubscription(subscriptions);
  if (!nearest) {
    return {
      primary: "长期有效",
      secondary: `共 ${subscriptions.length} 个脚本`,
      variant: "outline" as const,
    };
  }

  const level = getExpiryLevel(nearest.expires_at, nearest.plan_type);
  return {
    primary: formatDate(nearest.expires_at),
    secondary: subscriptions.length > 1 ? `${nearest.script_name} · 最近到期` : "",
    variant: mapExpiryLevelToVariant(level),
  };
}

function getSubscriptionToneClasses(subscription: SubscriptionBrief) {
  const level = getExpiryLevel(subscription.expires_at, subscription.plan_type);

  switch (level) {
    case "critical":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    case "lifetime":
      return "border-border/70 bg-muted/30 text-muted-foreground";
    default:
      return "border-success/30 bg-success/10 text-success";
  }
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-card/80">
      <CardContent className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/70 text-muted-foreground">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold leading-none text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingBadge({ customer }: { customer: CustomerListItem }) {
  const status = getRequestStatusMeta(customer);

  return (
    <Badge variant={status.variant} className="h-6 px-2 text-[11px]">
      {status.label}
    </Badge>
  );
}

function SubscriptionPill({ subscription }: { subscription: SubscriptionBrief }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-md border px-2 text-[11px] font-medium leading-none",
        getSubscriptionToneClasses(subscription),
      )}
    >
      <span className="truncate">
        {subscription.script_name} · {planTypeLabelMap[subscription.plan_type]}
      </span>
    </span>
  );
}

function SubscriptionCell({
  customerId,
  subscriptions,
  expanded,
  onToggle,
}: {
  customerId: number;
  subscriptions: SubscriptionBrief[];
  expanded: boolean;
  onToggle: (customerId: number) => void;
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-6 px-2 text-[11px]">
          暂无授权
        </Badge>
      </div>
    );
  }

  const sortedSubscriptions = sortSubscriptions(subscriptions);
  const visible = expanded ? sortedSubscriptions : sortedSubscriptions.slice(0, DEFAULT_VISIBLE_SUBSCRIPTIONS);
  const hiddenCount = Math.max(0, sortedSubscriptions.length - visible.length);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((subscription) => (
        <SubscriptionPill key={subscription.subscription_id} subscription={subscription} />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="inline-flex h-6 cursor-pointer items-center rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(customerId);
          }}
        >
          {expanded ? "收起" : `+${hiddenCount}`}
        </button>
      ) : null}
    </div>
  );
}

function ExpiryCell({ subscriptions }: { subscriptions: SubscriptionBrief[] }) {
  const summary = getExpirySummary(subscriptions);

  return (
    <div className="space-y-1">
      <Badge variant={summary.variant} className="h-6 px-2 text-[11px]">
        {summary.primary}
      </Badge>
      <div className="text-[11px] leading-none text-muted-foreground">{summary.secondary}</div>
    </div>
  );
}

export function AgentCustomerListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilter>("all");
  const [businessStatus, setBusinessStatus] = useState<BusinessStatusFilter>("all");
  const [expandedCustomers, setExpandedCustomers] = useState<Record<number, boolean>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tv_username: "", contact: "", remark: "" });

  const query = useQuery({
    queryKey: ["agent-customers", page, pageSize, keyword, businessStatus],
    queryFn: () =>
      listAgentCustomers({
        page,
        keyword,
        page_size: pageSize,
        subscription_status: businessStatus === "all" ? undefined : businessStatus,
      }),
  });

  const customers = query.data?.list ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const summary = useMemo(() => {
    const activeAuthorized = customers.filter((item) => item.active_subscriptions.length > 0).length;
    const expiringSoon = customers.filter((item) =>
      item.active_subscriptions.some((subscription) => isExpiringSoon(subscription.expires_at, subscription.plan_type)),
    ).length;
    const noSubscription = customers.filter((item) => item.active_subscriptions.length === 0).length;
    const pendingCustomers = customers.filter((item) => item.pending_request_count > 0).length;

    return {
      activeAuthorized,
      expiringSoon,
      noSubscription,
      pendingCustomers,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (maintenanceFilter === "all") {
      return customers;
    }
    return customers.filter((item) => getMaintenanceState(item).id === maintenanceFilter);
  }, [customers, maintenanceFilter]);

  const mutation = useMutation({
    mutationFn: () => createAgentCustomer(form),
    onSuccess: () => {
      notify({ title: "客户创建成功", tone: "success" });
      setOpen(false);
      setForm({ tv_username: "", contact: "", remark: "" });
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["agent-customers"] });
    },
  });

  useEffect(() => {
    const tvUsername = searchParams.get("tv_username") ?? "";
    const contactValue = searchParams.get("contact") ?? "";
    const remarkValue = searchParams.get("remark") ?? "";

    if (!tvUsername && !contactValue && !remarkValue) {
      return;
    }

    setForm({
      tv_username: tvUsername,
      contact: contactValue,
      remark: remarkValue,
    });
    setOpen(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("tv_username");
        next.delete("contact");
        next.delete("remark");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const columns: TableColumn<CustomerListItem>[] = [
    {
      key: "customer",
      header: "客户",
      className: "min-w-[200px]",
      render: (item) => {
        const maintenanceState = getMaintenanceState(item);

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{item.tv_username}</span>
              {maintenanceState.id !== "ready" ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {maintenanceState.label}
                </Badge>
              ) : null}
            </div>
            <div className="text-[11px] leading-none text-muted-foreground">{formatDateTime(item.created_at)}</div>
          </div>
        );
      },
    },
    {
      key: "subscriptions",
      header: "脚本授权",
      className: "min-w-[320px]",
      render: (item) => (
        <SubscriptionCell
          customerId={item.id}
          subscriptions={item.active_subscriptions}
          expanded={Boolean(expandedCustomers[item.id])}
          onToggle={(customerId) =>
            setExpandedCustomers((state) => ({
              ...state,
              [customerId]: !state[customerId],
            }))
          }
        />
      ),
    },
    {
      key: "expiry",
      header: "到期时间",
      className: "min-w-[150px]",
      render: (item) => <ExpiryCell subscriptions={item.active_subscriptions} />,
    },
    {
      key: "pending",
      header: "申请进度",
      className: "min-w-[88px]",
      render: (item) => <PendingBadge customer={item} />,
    },
    {
      key: "contact",
      header: "联系方式",
      className: "min-w-[180px]",
      render: (item) =>
        hasText(item.contact) ? (
          <div className="max-w-[180px] truncate text-[13px] font-medium text-foreground">{item.contact}</div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="size-3.5" />
            待补充
          </div>
        ),
    },
    {
      key: "actions",
      header: "操作",
      className: "w-[132px]",
      render: (item) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="xs"
            variant="outline"
            className="h-7 rounded-md px-2 text-[11px]"
            onClick={(event) => {
              event.stopPropagation();
              navigate(buildCustomerRequestPath(item));
            }}
          >
            发起申请
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="h-7 rounded-md px-2 text-[11px]"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/agent/customers/${item.id}`);
            }}
          >
            客户资料
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="我的客户"
        actions={
          <Button onClick={() => setOpen(true)} className="h-9 px-3 text-sm">
            <PlusCircle className="size-4" />
            新建客户
          </Button>
        }
      />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric icon={Users} label="客户总数" value={query.data?.total ?? 0} />
        <SummaryMetric icon={Users} label="活跃授权" value={summary.activeAuthorized} />
        <SummaryMetric icon={Clock3} label="7天内到期" value={summary.expiringSoon} />
        <SummaryMetric icon={AlertTriangle} label="待审核" value={summary.pendingCustomers} />
      </div>

      <Card>
        <CardContent className="grid gap-2 py-3 xl:grid-cols-[minmax(0,1fr)_160px_160px_auto] xl:items-center">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索 TV 用户名 / 联系方式 / 备注"
            className="h-9"
          />
          <Select
            value={businessStatus}
            onChange={(event) => {
              setBusinessStatus(event.target.value as BusinessStatusFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部状态" },
              { value: "active", label: "有活跃授权" },
              { value: "expiring_soon", label: "即将到期" },
              { value: "no_subscription", label: "暂无授权" },
              { value: "pending", label: "有待审核" },
            ]}
            className="h-9"
          />
          <Select
            value={maintenanceFilter}
            onChange={(event) => {
              setMaintenanceFilter(event.target.value as MaintenanceFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部资料" },
              { value: "missing_contact", label: "缺联系方式" },
              { value: "missing_remark", label: "缺备注" },
              { value: "ready", label: "资料完整" },
            ]}
            className="h-9"
          />
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              暂无授权 {summary.noSubscription}
            </Badge>
            <Badge variant="warning" className="h-6 px-2 text-[11px]">
              待跟进 {customers.filter((item) => item.pending_request_count > 0 || item.active_subscriptions.length === 0).length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <Card>
          <CardContent className="space-y-3 px-3 py-3">
            <DataTable
              data={filteredCustomers}
              columns={columns}
              keyExtractor={(item) => item.id}
              density="compact"
              empty={
                <EmptyState
                  icon={Users}
                  message={customers.length === 0 ? "还没有客户。" : "当前筛选没有结果。"}
                  action={customers.length === 0 ? "新建客户" : undefined}
                  onAction={customers.length === 0 ? () => setOpen(true) : undefined}
                />
              }
              onRowClick={(item) => navigate(`/agent/customers/${item.id}`)}
              mobileRender={(item) => {
                const maintenanceState = getMaintenanceState(item);
                const expirySummary = getExpirySummary(item.active_subscriptions);

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{item.tv_username}</p>
                          {maintenanceState.id !== "ready" ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              {maintenanceState.label}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                      </div>
                      <PendingBadge customer={item} />
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">脚本授权</div>
                      <SubscriptionCell
                        customerId={item.id}
                        subscriptions={item.active_subscriptions}
                        expanded={Boolean(expandedCustomers[item.id])}
                        onToggle={(customerId) =>
                          setExpandedCustomers((state) => ({
                            ...state,
                            [customerId]: !state[customerId],
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                      <div className="text-[11px] text-muted-foreground">最近到期</div>
                      <div className="text-right">
                        <Badge variant={expirySummary.variant} className="h-6 px-2 text-[11px]">
                          {expirySummary.primary}
                        </Badge>
                        <div className="mt-1 text-[11px] text-muted-foreground">{expirySummary.secondary}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[11px] text-muted-foreground">联系方式</span>
                      <span className="max-w-[65%] truncate text-right text-[13px] font-medium">
                        {hasText(item.contact) ? item.contact : "待补充"}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 flex-1 rounded-md px-2 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(buildCustomerRequestPath(item));
                        }}
                      >
                        发起申请
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-7 flex-1 rounded-md px-2 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/agent/customers/${item.id}`);
                        }}
                      >
                        客户资料
                      </Button>
                    </div>
                  </div>
                );
              }}
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
        onClose={() => setOpen(false)}
        title="新建客户"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "保存中..." : "保存客户"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">TV 用户名</label>
            <TVUsernameInput
              value={form.tv_username}
              onChange={(value) => setForm((state) => ({ ...state, tv_username: value }))}
            />
          </div>
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
        </div>
      </Dialog>
    </div>
  );
}
