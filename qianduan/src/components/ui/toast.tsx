import { useEffect } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const toneClasses = {
  default: "border-border bg-card text-foreground",
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/30 bg-warning/12 text-warning",
  destructive: "border-destructive/30 bg-destructive/12 text-destructive",
} as const;

const toneIcons = {
  default: Info,
  success: CircleCheck,
  warning: CircleAlert,
  destructive: CircleAlert,
} as const;

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, 4000),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = toneIcons[toast.tone ?? "default"];
        return (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg border px-4 py-3 shadow-sm backdrop-blur-md",
              toneClasses[toast.tone ?? "default"],
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <Button variant="ghost" size="xs" onClick={() => removeToast(toast.id)} className="h-auto p-1">
                <X className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
