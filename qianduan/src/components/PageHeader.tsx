import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 px-5 py-4 panel-sheen lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Control Plane</div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  );
}
