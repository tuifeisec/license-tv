import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PropertyRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right text-sm">{value}</div>
    </div>
  );
}
