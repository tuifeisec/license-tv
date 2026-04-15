import { AlertTriangle } from "lucide-react";

import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { AccessAuditEntry } from "@/types/api";

const columns: TableColumn<AccessAuditEntry>[] = [
  {
    key: "script",
    header: "脚本",
    render: (item) => item.script_name,
  },
  {
    key: "tv",
    header: "TV 授权数",
    render: (item) => item.tv_user_count,
  },
  {
    key: "db",
    header: "库内生效数",
    render: (item) => item.db_active_count,
  },
  {
    key: "missing",
    header: "库内缺失于 TV",
    render: (item) => item.missing_on_tv.join(", ") || "无",
  },
  {
    key: "extra",
    header: "TV 额外授权",
    render: (item) => item.extra_on_tv.join(", ") || "无",
  },
  {
    key: "status",
    header: "结果",
    render: (item) =>
      item.error ? (
        <StatusBadge status="error" />
      ) : item.missing_on_tv.length > 0 || item.extra_on_tv.length > 0 ? (
        <StatusBadge status="pending" />
      ) : (
        <StatusBadge status="approved" />
      ),
  },
];

export function AuditReportTable({ entries }: { entries: AccessAuditEntry[] }) {
  return (
    <DataTable
      data={entries}
      columns={columns}
      keyExtractor={(item) => item.script_id}
      empty={<EmptyState icon={AlertTriangle} message="暂时没有可展示的对账结果。" />}
    />
  );
}
