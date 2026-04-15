import { cn } from "@/lib/utils";

export function ScriptStatusToggle({
  checked,
  onCheckedChange,
  pending = false,
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const locked = disabled || pending;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={locked}
      className={cn(
        "ring-focus inline-flex h-9 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors",
        checked
          ? "border-success/35 bg-success/15 text-success hover:bg-success/20"
          : "border-border bg-background/80 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        locked && "cursor-not-allowed opacity-60",
        !locked && "cursor-pointer",
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "relative flex h-5 w-9 items-center rounded-full border transition-colors",
          checked ? "border-success/35 bg-success/20" : "border-border bg-muted/70",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-foreground shadow-sm transition-transform",
            checked && "translate-x-4 bg-success",
          )}
        />
      </span>
      <span>{pending ? "处理中" : checked ? "已启用" : "已停用"}</span>
    </button>
  );
}
