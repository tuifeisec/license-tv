import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RotateCcw, Search, ShieldUser } from "lucide-react";

import {
  createSubAdmin,
  getSubAdmin,
  listSubAdmins,
  resetSubAdminPassword,
  updateSubAdmin,
  updateSubAdminScripts,
} from "@/api/sub-admins";
import { listScripts } from "@/api/scripts";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { SubAdminPasswordResetDialog } from "@/components/SubAdminPasswordResetDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { Script, SubAdminSummary } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_FORM = {
  username: "",
  password: "",
  display_name: "",
  status: "1",
};
const SCRIPT_PAGE_SIZE_OPTIONS = [24, 50, 100];

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "enabled", label: "仅启用" },
  { value: "disabled", label: "仅禁用" },
];

function statusLabel(status?: number) {
  return status === 1 ? "启用" : "禁用";
}

function statusVariant(status?: number): "success" | "destructive" {
  return status === 1 ? "success" : "destructive";
}

function ScriptPermissionDialog({
  open,
  subAdmin,
  pending,
  scripts,
  loading,
  selectedScriptIDs,
  scriptSearch,
  scriptPage,
  scriptPageSize,
  totalScripts,
  totalScriptPages,
  fetchingScripts,
  onSearchChange,
  onToggleScript,
  onSelectVisible,
  onClear,
  onClose,
  onSubmit,
  onPageChange,
  onPageSizeChange,
}: {
  open: boolean;
  subAdmin: SubAdminSummary | null;
  pending?: boolean;
  scripts: Script[];
  loading?: boolean;
  selectedScriptIDs: number[];
  scriptSearch: string;
  scriptPage: number;
  scriptPageSize: number;
  totalScripts: number;
  totalScriptPages: number;
  fetchingScripts?: boolean;
  onSearchChange: (value: string) => void;
  onToggleScript: (scriptID: number) => void;
  onSelectVisible: () => void;
  onClear: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="脚本分配"
      description={subAdmin ? `配置 ${subAdmin.display_name || subAdmin.username} 可管理的脚本范围。` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="outline" onClick={onClear} disabled={loading || pending}>
            清空权限
          </Button>
          <Button onClick={onSubmit} disabled={loading || pending}>
            {pending ? "保存中..." : `保存分配 (${selectedScriptIDs.length})`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={scriptSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索脚本名称或 Pine ID"
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={onSelectVisible} disabled={loading || scripts.length === 0}>
            全选当前页
          </Button>
          <div className="flex items-center justify-end">
            <Badge variant="outline" className="h-10 rounded-md px-3">
              已选 {selectedScriptIDs.length} 项
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          <span>脚本总数 {totalScripts}，当前页可见 {scripts.length} 项。</span>
          <span>如需覆盖更多脚本，可继续翻页后批量勾选。</span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
            正在加载脚本权限...
          </div>
        ) : scripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
            当前筛选下没有脚本。
          </div>
        ) : (
          <div className="grid max-h-[52vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {scripts.map((script) => {
              const checked = selectedScriptIDs.includes(script.id);

              return (
                <label
                  key={script.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    checked
                      ? "border-primary/45 bg-primary/8"
                      : "border-border/70 bg-background/40 hover:border-primary/30 hover:bg-accent/35"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--primary)]"
                    checked={checked}
                    onChange={() => onToggleScript(script.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold">{script.name}</div>
                      <Badge variant={script.status === 1 ? "success" : "destructive"}>{statusLabel(script.status)}</Badge>
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{script.pine_id}</div>
                    {script.description ? <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{script.description}</div> : null}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <PaginationBar
          page={scriptPage}
          totalPages={totalScriptPages}
          total={totalScripts}
          pageSize={scriptPageSize}
          pageSizeOptions={SCRIPT_PAGE_SIZE_OPTIONS}
          fetching={fetchingScripts || pending}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </Dialog>
  );
}

export function SubAdminListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openEditor, setOpenEditor] = useState(false);
  const [editing, setEditing] = useState<SubAdminSummary | null>(null);
  const [resetting, setResetting] = useState<SubAdminSummary | null>(null);
  const [scriptTarget, setScriptTarget] = useState<SubAdminSummary | null>(null);
  const [scriptSearch, setScriptSearch] = useState("");
  const [scriptPage, setScriptPage] = useState(1);
  const [scriptPageSize, setScriptPageSize] = useState(24);
  const [selectedScriptIDs, setSelectedScriptIDs] = useState<number[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const editorInputRef = useRef<HTMLInputElement>(null);

  const deferredKeyword = useDeferredValue(keyword.trim());
  const deferredScriptSearch = useDeferredValue(scriptSearch.trim());

  const listQuery = useQuery({
    queryKey: ["sub-admins", page, pageSize, deferredKeyword, statusFilter],
    queryFn: () =>
      listSubAdmins({
        page,
        page_size: pageSize,
        keyword: deferredKeyword || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["sub-admin-detail", scriptTarget?.id],
    queryFn: () => getSubAdmin(scriptTarget!.id),
    enabled: Boolean(scriptTarget?.id),
  });

  const scriptsQuery = useQuery({
    queryKey: ["sub-admin-script-catalog", scriptTarget?.id, scriptPage, scriptPageSize, deferredScriptSearch],
    queryFn: () =>
      listScripts({
        page: scriptPage,
        page_size: scriptPageSize,
        keyword: deferredScriptSearch || undefined,
      }),
    enabled: Boolean(scriptTarget),
  });

  useEffect(() => {
    if (openEditor) {
      window.setTimeout(() => editorInputRef.current?.focus(), 0);
    }
  }, [openEditor]);

  useEffect(() => {
    if (detailQuery.data && scriptTarget) {
      setSelectedScriptIDs(detailQuery.data.scripts.map((script) => script.id));
    }
  }, [detailQuery.data, scriptTarget]);

  useEffect(() => {
    setScriptSearch("");
    setScriptPage(1);
    setScriptPageSize(24);
    setSelectedScriptIDs([]);
  }, [scriptTarget?.id]);

  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.page_size ?? pageSize)));
  const totalScriptPages = Math.max(
    1,
    Math.ceil((scriptsQuery.data?.total ?? 0) / (scriptsQuery.data?.page_size ?? scriptPageSize)),
  );

  const summary = useMemo(() => {
    const list = listQuery.data?.list ?? [];
    return {
      total: listQuery.data?.total ?? 0,
      enabled: list.filter((item) => item.status === 1).length,
      disabled: list.filter((item) => item.status !== 1).length,
    };
  }, [listQuery.data]);

  const currentPageScripts = scriptsQuery.data?.list ?? [];

  const openCreateDialog = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setOpenEditor(true);
  };

  const openEditDialog = (item: SubAdminSummary) => {
    setEditing(item);
    setForm({
      username: item.username,
      password: "",
      display_name: item.display_name ?? "",
      status: String(item.status ?? 1),
    });
    setOpenEditor(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createSubAdmin({
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        status: Number(form.status),
        script_ids: [],
      }),
    onSuccess: () => {
      notify({ title: "管理员创建成功", tone: "success" });
      setOpenEditor(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["sub-admins"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateSubAdmin(editing.id, {
            display_name: form.display_name.trim(),
            status: Number(form.status),
          })
        : Promise.resolve(null),
    onSuccess: () => {
      notify({ title: "管理员信息已更新", tone: "success" });
      setOpenEditor(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["sub-admins"] });
      if (scriptTarget?.id) {
        queryClient.invalidateQueries({ queryKey: ["sub-admin-detail", scriptTarget.id] });
      }
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      resetSubAdminPassword(id, { new_password: newPassword }),
    onSuccess: () => {
      notify({ title: "管理员密码已重置", tone: "success" });
      setResetting(null);
    },
  });

  const updateScriptsMutation = useMutation({
    mutationFn: ({ id, scriptIDs }: { id: number; scriptIDs: number[] }) =>
      updateSubAdminScripts(id, { script_ids: scriptIDs }),
    onSuccess: () => {
      notify({ title: "脚本权限已保存", tone: "success" });
      if (scriptTarget?.id) {
        queryClient.invalidateQueries({ queryKey: ["sub-admin-detail", scriptTarget.id] });
      }
      setScriptTarget(null);
    },
  });

  const columns: TableColumn<SubAdminSummary>[] = [
    {
      key: "username",
      header: "用户名",
      render: (item) => (
        <div className="space-y-1">
          <div className="font-medium">{item.username}</div>
          <div className="text-xs text-muted-foreground">受脚本约束的管理账号</div>
        </div>
      ),
    },
    {
      key: "display_name",
      header: "显示名称",
      render: (item) => item.display_name || "未设置",
    },
    {
      key: "role",
      header: "角色",
      render: () => <Badge variant="outline">管理员</Badge>,
    },
    {
      key: "status",
      header: "状态",
      render: (item) => <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>,
    },
    {
      key: "updated_at",
      header: "最近更新",
      className: "hidden xl:table-cell",
      render: (item) => formatDateTime(item.updated_at),
    },
    {
      key: "actions",
      header: "操作",
      className: "w-[280px]",
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              setScriptTarget(item);
            }}
          >
            分配脚本
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              openEditDialog(item);
            }}
          >
            编辑
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              setResetting(item);
            }}
          >
            <KeyRound className="size-3.5" />
            重置密码
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="管理员"
        description="管理受脚本权限约束的后台账号，并为其分配可操作的脚本范围。"
        actions={<Button onClick={openCreateDialog}>新建管理员</Button>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-card/75">
          <CardContent className="space-y-2 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</div>
            <div className="text-2xl font-semibold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">当前筛选结果总量</div>
          </CardContent>
        </Card>
        <Card className="bg-card/75">
          <CardContent className="space-y-2 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Enabled</div>
            <div className="text-2xl font-semibold text-success">{summary.enabled}</div>
            <div className="text-xs text-muted-foreground">当前页处于启用状态</div>
          </CardContent>
        </Card>
        <Card className="bg-card/75">
          <CardContent className="space-y-2 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Disabled</div>
            <div className="text-2xl font-semibold text-destructive">{summary.disabled}</div>
            <div className="text-xs text-muted-foreground">当前页处于禁用状态</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="搜索用户名或显示名称"
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setKeyword("");
              setStatusFilter("all");
              setPage(1);
            }}
          >
            <RotateCcw className="size-4" />
            重置
          </Button>
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <DataTable
              data={listQuery.data?.list ?? []}
              columns={columns}
              keyExtractor={(item) => item.id}
              empty={<EmptyState icon={ShieldUser} message="还没有管理员账号，可以先创建一个。" />}
            />
            <PaginationBar
              page={listQuery.data?.page ?? page}
              totalPages={totalPages}
              total={listQuery.data?.total ?? 0}
              pageSize={listQuery.data?.page_size ?? pageSize}
              fetching={listQuery.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={openEditor}
        onClose={() => {
          setOpenEditor(false);
          setEditing(null);
        }}
        title={editing ? "编辑管理员" : "新建管理员"}
        description="管理员只能访问被分配的脚本及其关联业务数据。"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpenEditor(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => (editing ? updateMutation.mutate() : createMutation.mutate())}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                form.username.trim().length === 0 ||
                (!editing && form.password.length < 6)
              }
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            ref={editorInputRef}
            value={form.username}
            onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
            placeholder="用户名"
            disabled={Boolean(editing)}
          />
          {!editing ? (
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
              placeholder="初始密码，至少 6 位"
            />
          ) : null}
          <Input
            value={form.display_name}
            onChange={(event) => setForm((state) => ({ ...state, display_name: event.target.value }))}
            placeholder="显示名称"
          />
          <Select
            value={form.status}
            onChange={(event) => setForm((state) => ({ ...state, status: event.target.value }))}
            options={[
              { value: "1", label: "启用" },
              { value: "0", label: "禁用" },
            ]}
          />
        </div>
      </Dialog>

      <SubAdminPasswordResetDialog
        open={Boolean(resetting)}
        subAdmin={resetting}
        pending={resetPasswordMutation.isPending}
        onClose={() => setResetting(null)}
        onSubmit={(newPassword) => resetting && resetPasswordMutation.mutate({ id: resetting.id, newPassword })}
      />

      <ScriptPermissionDialog
        open={Boolean(scriptTarget)}
        subAdmin={scriptTarget}
        pending={updateScriptsMutation.isPending}
        scripts={currentPageScripts}
        loading={detailQuery.isLoading || scriptsQuery.isLoading}
        selectedScriptIDs={selectedScriptIDs}
        scriptSearch={scriptSearch}
        scriptPage={scriptsQuery.data?.page ?? scriptPage}
        scriptPageSize={scriptsQuery.data?.page_size ?? scriptPageSize}
        totalScripts={scriptsQuery.data?.total ?? 0}
        totalScriptPages={totalScriptPages}
        fetchingScripts={scriptsQuery.isFetching}
        onSearchChange={(value) => {
          setScriptSearch(value);
          setScriptPage(1);
        }}
        onToggleScript={(scriptID) =>
          setSelectedScriptIDs((state) =>
            state.includes(scriptID) ? state.filter((value) => value !== scriptID) : [...state, scriptID],
          )
        }
        onSelectVisible={() =>
          setSelectedScriptIDs((state) => {
            const merged = new Set([...state, ...currentPageScripts.map((item) => item.id)]);
            return Array.from(merged);
          })
        }
        onClear={() => setSelectedScriptIDs([])}
        onClose={() => setScriptTarget(null)}
        onSubmit={() =>
          scriptTarget &&
          updateScriptsMutation.mutate({
            id: scriptTarget.id,
            scriptIDs: selectedScriptIDs,
          })
        }
        onPageChange={setScriptPage}
        onPageSizeChange={(value) => {
          setScriptPageSize(value);
          setScriptPage(1);
        }}
      />
    </div>
  );
}
