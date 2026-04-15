import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (item: T) => ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  mobileRender,
  empty,
  onRowClick,
  density = "default",
}: {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor: (item: T) => string | number;
  mobileRender?: (item: T) => ReactNode;
  empty?: ReactNode;
  onRowClick?: (item: T) => void;
  density?: "default" | "compact";
}) {
  if (data.length === 0 && empty) {
    return <>{empty}</>;
  }

  const headerCellClassName =
    density === "compact"
      ? "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      : "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const bodyCellClassName = density === "compact" ? "px-3 py-2 align-middle text-sm" : "px-4 py-3 align-middle text-sm";
  const mobileCardClassName = density === "compact" ? "space-y-2 p-3" : "space-y-2 p-4";

  return (
    <>
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-accent/40 backdrop-blur-sm">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(headerCellClassName, column.className)}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    "border-t border-border/70 transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-accent/40 focus-within:bg-accent/30" : "",
                  )}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cn(bodyCellClassName, column.className)}>
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            className={cn("transition-colors", onRowClick ? "cursor-pointer hover:bg-accent/30" : "")}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
          >
            <CardContent className={mobileCardClassName}>
              {mobileRender
                ? mobileRender(item)
                : columns.map((column) => (
                    <div key={column.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{column.header}</span>
                      <div className="text-right">{column.render(item)}</div>
                    </div>
                  ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
