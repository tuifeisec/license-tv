import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Search, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { TVUserHint } from "@/types/api";

export function TVUsernameInput({
  value,
  onChange,
  validator,
  placeholder = "输入 TradingView 用户名",
  hintLabel = "匹配结果",
}: {
  value: string;
  onChange: (value: string) => void;
  validator?: (keyword: string) => Promise<TVUserHint[]>;
  placeholder?: string;
  hintLabel?: string;
}) {
  const canValidate = typeof validator === "function";
  const debounced = useDebouncedValue(value, 400);
  const query = useQuery({
    queryKey: ["tv-username-validate", debounced],
    queryFn: () => (validator ? validator(debounced) : Promise.resolve([])),
    enabled: canValidate && debounced.trim().length >= 2,
  });

  const exactMatch = useMemo(
    () => query.data?.find((item) => item.username.toLowerCase() === value.trim().toLowerCase()),
    [query.data, value],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {canValidate && debounced.trim().length < 2 ? (
        <p className="text-xs text-muted-foreground">输入至少 2 个字符后开始校验用户名。</p>
      ) : null}

      {canValidate && query.isFetching ? (
        <p className="text-xs text-muted-foreground">正在查询 TradingView 用户信息...</p>
      ) : null}

      {canValidate && exactMatch ? (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <CheckCircle2 className="size-4" />
          <span>用户名有效，已匹配到 `{exactMatch.username}`。</span>
        </div>
      ) : null}

      {canValidate && !query.isFetching && debounced.trim().length >= 2 && query.data && query.data.length > 0 ? (
        <div className="rounded-md border border-border/70 bg-background/60 p-3">
          <p className="mb-2 text-xs text-muted-foreground">{hintLabel}</p>
          <div className="flex flex-wrap gap-2">
            {query.data.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.username)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  exactMatch?.id === item.id
                    ? "border-success/30 bg-success/15 text-success"
                    : "border-border bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {item.username}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canValidate && !query.isFetching && debounced.trim().length >= 2 && query.data && query.data.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <TriangleAlert className="size-4" />
          <span>未找到该 TradingView 用户名，请确认拼写。</span>
        </div>
      ) : null}
    </div>
  );
}
