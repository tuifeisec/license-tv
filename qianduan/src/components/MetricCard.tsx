import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  icon: Icon,
  value,
  label,
  description,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 py-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-primary shadow-sm">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
