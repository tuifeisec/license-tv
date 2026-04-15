import type { PropsWithChildren, ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

export function SidePanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  className?: string;
}>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close side panel"
      />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-sm",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold">{title}</div>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close side panel">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </aside>
    </div>
  );
}
