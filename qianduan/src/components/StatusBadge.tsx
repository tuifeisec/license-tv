import { Badge } from "@/components/ui/badge";

const config: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "outline" | "default" }
> = {
  approved: { label: "已通过", variant: "success" },
  active: { label: "生效中", variant: "success" },
  completed: { label: "已完成", variant: "success" },
  pending: { label: "待处理", variant: "warning" },
  idle: { label: "待命", variant: "warning" },
  rejected: { label: "已拒绝", variant: "destructive" },
  revoked: { label: "已回收", variant: "destructive" },
  failed: { label: "失败", variant: "destructive" },
  error: { label: "错误", variant: "destructive" },
  cancelled: { label: "已取消", variant: "outline" },
  expired: { label: "已过期", variant: "outline" },
  archived: { label: "已归档", variant: "outline" },
  disabled: { label: "已停用", variant: "outline" },
};

export function StatusBadge({ status }: { status: string }) {
  const item = config[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
