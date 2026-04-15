import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createCustomer, listCustomers, validateTVUsername } from "@/api/customers";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PaginationBar } from "@/components/PaginationBar";
import { TVUsernameInput } from "@/components/TVUsernameInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/store/ui-store";
import type { Customer } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

export function CustomerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    tv_username: "",
    contact: "",
    remark: "",
    agent_id: "",
  });

  const query = useQuery({
    queryKey: ["customers", page, pageSize, keyword],
    queryFn: () => listCustomers({ page, keyword, page_size: pageSize }),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? pageSize)));

  const mutation = useMutation({
    mutationFn: () =>
      createCustomer({
        tv_username: form.tv_username,
        contact: form.contact,
        remark: form.remark,
        agent_id: form.agent_id ? Number(form.agent_id) : undefined,
      }),
    onSuccess: () => {
      notify({ title: "客户创建成功", tone: "success" });
      setCreateOpen(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const columns: TableColumn<Customer>[] = [
    { key: "tv", header: "TV 用户名", render: (item) => <span className="font-medium">{item.tv_username}</span> },
    { key: "contact", header: "联系方式", render: (item) => item.contact || "—" },
    { key: "agent", header: "所属代理", render: (item) => item.agent_id ?? "—" },
    { key: "created", header: "创建时间", render: (item) => formatDateTime(item.created_at) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="客户列表"
        description="集中管理 TradingView 客户资料。新建客户前会实时校验 TV 用户名是否存在。"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusCircle className="size-4" />
            新建客户
          </Button>
        }
      />

      <Card>
        <CardContent className="py-4">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索 TV 用户名或联系方式"
          />
        </CardContent>
      </Card>

      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <DataTable
              data={query.data?.list ?? []}
              columns={columns}
              keyExtractor={(item) => item.id}
              empty={<EmptyState icon={Users} message="还没有客户数据，可以先创建一位客户。" />}
              onRowClick={(item) => navigate(`/customers/${item.id}`)}
            />
            <PaginationBar
              page={query.data?.page ?? page}
              totalPages={totalPages}
              total={query.data?.total ?? 0}
              pageSize={query.data?.page_size ?? pageSize}
              fetching={query.isFetching}
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建客户"
        description="客户创建时会自动校验 TV 用户名，并尝试获取对应的 TradingView 用户 ID。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "保存中..." : "保存客户"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TVUsernameInput
            value={form.tv_username}
            onChange={(value) => setForm((state) => ({ ...state, tv_username: value }))}
            validator={validateTVUsername}
          />
          <Input
            value={form.contact}
            onChange={(event) => setForm((state) => ({ ...state, contact: event.target.value }))}
            placeholder="联系方式，如 wechat:demo"
          />
          <Input
            type="number"
            value={form.agent_id}
            onChange={(event) => setForm((state) => ({ ...state, agent_id: event.target.value }))}
            placeholder="所属代理 ID，可选"
          />
          <Textarea
            value={form.remark}
            onChange={(event) => setForm((state) => ({ ...state, remark: event.target.value }))}
            placeholder="客户备注"
          />
        </div>
      </Dialog>
    </div>
  );
}
