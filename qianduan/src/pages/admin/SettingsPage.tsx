import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, Eye } from "lucide-react";

import { getTVSessionStatus, listOperationLogs, syncAccessAudit, updateTVCookies } from "@/api/system";
import { AuditReportTable } from "@/components/AuditReportTable";
import { CookieStatusCard } from "@/components/CookieStatusCard";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/PageSkeleton";
import { formatDateTime, parseOperationDetail } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { OperationLog } from "@/types/api";

function normalizeOperationDetail(detail: unknown) {
  const parsed = parseOperationDetail(detail);
  try {
    return JSON.parse(parsed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeOperationDetail(detail: unknown) {
  const objectDetail = normalizeOperationDetail(detail);
  if (!objectDetail) {
    return parseOperationDetail(detail).replace(/\s+/g, " ").trim().slice(0, 120) || "无详情";
  }

  if (typeof objectDetail.summary === "string" && objectDetail.summary.trim() !== "") {
    return objectDetail.summary.trim();
  }

  if (Array.isArray(objectDetail.scripts)) {
    const scripts = objectDetail.scripts as Array<Record<string, unknown>>;
    const inserted = scripts.reduce((sum, item) => sum + Number(item.inserted_count ?? 0), 0);
    const removed = scripts.reduce((sum, item) => sum + Number(item.removed_count ?? 0), 0);
    return `脚本 ${scripts.length} 个，新增 ${inserted}，移除 ${removed}`;
  }

  if (Array.isArray(objectDetail.entries)) {
    const entries = objectDetail.entries as Array<Record<string, unknown>>;
    const mismatches = entries.filter((item) => {
      const missing = Array.isArray(item.missing_on_tv) ? item.missing_on_tv.length : 0;
      const extra = Array.isArray(item.extra_on_tv) ? item.extra_on_tv.length : 0;
      return missing > 0 || extra > 0 || item.error;
    }).length;
    return `对账脚本 ${entries.length} 个，异常 ${mismatches} 个`;
  }

  const importantKeys = ["reason", "plan_type", "expires_at", "script_count", "mismatch_count", "error_count"];
  const segments = importantKeys
    .filter((key) => objectDetail[key] !== undefined && objectDetail[key] !== null && objectDetail[key] !== "")
    .map((key) => `${key}: ${String(objectDetail[key])}`);

  if (segments.length > 0) {
    return segments.join(" | ");
  }

  const keys = Object.keys(objectDetail);
  return keys.length > 0 ? `字段 ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? " ..." : ""}` : "结构化详情";
}

function getActionBadgeVariant(action: string) {
  if (action.includes("reject") || action.includes("revoke")) {
    return "destructive" as const;
  }
  if (action.includes("sync") || action.includes("audit")) {
    return "warning" as const;
  }
  if (action.includes("approve") || action.includes("grant") || action.includes("renew")) {
    return "success" as const;
  }
  return "outline" as const;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [cookieForm, setCookieForm] = useState({ sessionid: "", sessionid_sign: "" });
  const [actionFilter, setActionFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["tv-session-status"],
    queryFn: getTVSessionStatus,
  });

  const logsQuery = useQuery({
    queryKey: ["operation-logs", actionFilter],
    queryFn: () => listOperationLogs({ action: actionFilter, page_size: 30 }),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateTVCookies(cookieForm),
    onSuccess: () => {
      notify({ title: "Cookie 已更新", tone: "success" });
      setCookieForm({ sessionid: "", sessionid_sign: "" });
      queryClient.invalidateQueries({ queryKey: ["tv-session-status"] });
    },
  });

  const auditMutation = useMutation({
    mutationFn: syncAccessAudit,
    onSuccess: () => {
      notify({ title: "授权对账完成", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["operation-logs"] });
    },
  });

  const logRows = useMemo(
    () =>
      (logsQuery.data?.list ?? []).map((item) => ({
        ...item,
        detailSummary: summarizeOperationDetail(item.detail),
        detailRaw: parseOperationDetail(item.detail),
      })),
    [logsQuery.data],
  );

  const columns: TableColumn<(typeof logRows)[number]>[] = [
    {
      key: "id",
      header: "ID",
      render: (item) => <span className="font-mono text-xs text-muted-foreground">#{item.id}</span>,
    },
    {
      key: "action",
      header: "动作",
      render: (item) => <Badge variant={getActionBadgeVariant(item.action)}>{item.action}</Badge>,
    },
    {
      key: "target",
      header: "目标",
      render: (item) => (
        <div className="text-sm">
          <p className="font-medium">{item.target_type}</p>
          <p className="text-xs text-muted-foreground">{item.target_id ? `#${item.target_id}` : "系统级操作"}</p>
        </div>
      ),
    },
    {
      key: "time",
      header: "时间",
      render: (item) => formatDateTime(item.created_at),
    },
    {
      key: "ip",
      header: "IP",
      className: "hidden lg:table-cell",
      render: (item) => item.ip || "未知",
    },
    {
      key: "detail",
      header: "摘要",
      className: "hidden xl:table-cell",
      render: (item) => (
        <div className="max-w-xl">
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.detailSummary}</p>
        </div>
      ),
    },
    {
      key: "view",
      header: "详情",
      render: (item) => (
        <Button
          size="xs"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedLog(item);
          }}
        >
          <Eye className="size-3.5" />
          查看
        </Button>
      ),
    },
  ];

  if (sessionQuery.isLoading && logsQuery.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="集中维护 TV Cookie、执行授权对账，并查看关键操作日志。"
        actions={
          <Button onClick={() => auditMutation.mutate()} disabled={auditMutation.isPending}>
            <DatabaseZap className="size-4" />
            {auditMutation.isPending ? "对账中..." : "手动对账"}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        {sessionQuery.data ? <CookieStatusCard data={sessionQuery.data} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>更新 Cookie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={cookieForm.sessionid}
              onChange={(event) => setCookieForm((state) => ({ ...state, sessionid: event.target.value }))}
              placeholder="sessionid"
            />
            <Input
              value={cookieForm.sessionid_sign}
              onChange={(event) => setCookieForm((state) => ({ ...state, sessionid_sign: event.target.value }))}
              placeholder="sessionid_sign"
            />
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "更新 Cookie"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {auditMutation.data ? (
        <Card>
          <CardHeader>
            <CardTitle>最近一次对账结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">执行时间</p>
                <p className="mt-2 text-sm font-medium">{formatDateTime(auditMutation.data.ran_at)}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">脚本数</p>
                <p className="mt-2 text-sm font-medium">{auditMutation.data.script_count}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">异常数</p>
                <p className="mt-2 text-sm font-medium">{auditMutation.data.mismatch_count}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">错误数</p>
                <p className="mt-2 text-sm font-medium">{auditMutation.data.error_count}</p>
              </div>
            </div>
            <AuditReportTable entries={auditMutation.data.entries} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>操作日志</CardTitle>
          <p className="text-sm text-muted-foreground">日志列表优先展示摘要，完整结构化详情可在弹窗中查看。</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            placeholder="按 action 过滤，例如 approve_request"
          />
          <DataTable
            data={logRows}
            columns={columns}
            keyExtractor={(item) => item.id}
            empty={<EmptyState icon={DatabaseZap} message="暂时没有操作日志。" />}
            mobileRender={(item) => (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={getActionBadgeVariant(item.action)}>{item.action}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {item.target_type}
                    {item.target_id ? ` #${item.target_id}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.detailSummary}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">IP: {item.ip || "未知"}</span>
                  <Button size="xs" variant="outline" onClick={() => setSelectedLog(item)}>
                    查看详情
                  </Button>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `日志详情 · ${selectedLog.action}` : "日志详情"}
        description={selectedLog ? `${selectedLog.target_type}${selectedLog.target_id ? ` #${selectedLog.target_id}` : ""}` : undefined}
        footer={
          <Button variant="outline" onClick={() => setSelectedLog(null)}>
            关闭
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">动作</div>
              <div className="mt-2">
                <Badge variant={selectedLog ? getActionBadgeVariant(selectedLog.action) : "outline"}>
                  {selectedLog?.action ?? "未知"}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">时间</div>
              <div className="mt-2 text-sm font-medium">{formatDateTime(selectedLog?.created_at)}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">目标</div>
              <div className="mt-2 text-sm font-medium">
                {selectedLog?.target_type ?? "未知"}
                {selectedLog?.target_id ? ` #${selectedLog.target_id}` : ""}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">IP</div>
              <div className="mt-2 text-sm font-medium">{selectedLog?.ip || "未知"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="mb-3 text-sm font-semibold">完整详情</div>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background/70 p-3 font-mono text-xs text-muted-foreground">
              {selectedLog ? parseOperationDetail(selectedLog.detail) : ""}
            </pre>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
