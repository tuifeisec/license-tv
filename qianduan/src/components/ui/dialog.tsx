import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
}>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="text-sm font-semibold">{title}</div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className={cn("flex flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:justify-end")}>
          {footer}
        </div>
      </div>
      <button className="absolute inset-0 -z-10 cursor-default" onClick={onClose} aria-label="关闭弹窗" />
    </div>
  );
}
