import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  message,
  action,
  onAction,
}: {
  icon: LucideIcon;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full border border-border bg-background/70 p-4 text-muted-foreground">
          <Icon className="size-6" />
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        {action && onAction ? (
          <Button variant="outline" onClick={onAction}>
            {action}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
