import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  fetching,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  fetching?: boolean;
}) {
  const [jumpPage, setJumpPage] = useState(String(page));

  useEffect(() => {
    setJumpPage(String(page));
  }, [page]);

  if (total <= 0) {
    return null;
  }

  const submitJump = () => {
    const parsed = Number(jumpPage);
    if (!Number.isFinite(parsed)) {
      setJumpPage(String(page));
      return;
    }

    const target = Math.min(totalPages, Math.max(1, Math.floor(parsed)));
    setJumpPage(String(target));
    if (target !== page) {
      onPageChange(target);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 xl:flex-row xl:items-center xl:justify-between">
      <p className="text-sm text-muted-foreground">
        第 {page} / {totalPages} 页，共 {total} 条记录，每页 {pageSize} 条
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">每页</span>
            <Select
              className="w-28"
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              options={pageSizeOptions.map((value) => ({ value: String(value), label: `${value} 条` }))}
              disabled={fetching}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">跳至</span>
          <Input
            className="w-20"
            value={jumpPage}
            inputMode="numeric"
            onChange={(event) => setJumpPage(event.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitJump();
              }
            }}
            disabled={fetching}
          />
          <Button variant="outline" disabled={fetching} onClick={submitJump}>
            跳转
          </Button>
        </div>

        <Button variant="outline" disabled={page <= 1 || fetching} onClick={() => onPageChange(Math.max(1, page - 1))}>
          上一页
        </Button>
        <Button
          variant="outline"
          disabled={page >= totalPages || fetching}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
