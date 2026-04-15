import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getScript, getScriptUsers, updateScript } from "@/api/scripts";
import { AuthorizedUsersPanel } from "@/components/AuthorizedUsersPanel";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PropertyRow } from "@/components/PropertyRow";
import { ScriptStatusToggle } from "@/components/ScriptStatusToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { notify } from "@/store/ui-store";
import type { Script } from "@/types/api";

export function ScriptDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState<Partial<Script>>({});

  const canViewAuthorizedUsers = user?.role === "admin" || user?.role === "super_admin";

  const query = useQuery({
    queryKey: ["script", id],
    queryFn: () => getScript(id),
  });

  const usersQuery = useQuery({
    queryKey: ["script-users", id],
    queryFn: () => getScriptUsers(id),
    enabled: canViewAuthorizedUsers,
  });

  useEffect(() => {
    if (query.data) {
      setForm(query.data);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateScript(id, {
        name: form.name,
        description: form.description,
        monthly_price: Number(form.monthly_price ?? 0),
        quarterly_price: Number(form.quarterly_price ?? 0),
        yearly_price: Number(form.yearly_price ?? 0),
        lifetime_price: Number(form.lifetime_price ?? 0),
        trial_days: Number(form.trial_days ?? 0),
        status: Number(form.status ?? 1),
      }),
    onSuccess: () => {
      notify({ title: "脚本已更新", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["script", id] });
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      queryClient.invalidateQueries({ queryKey: ["script-options"] });
    },
  });

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const script = query.data!;
  const currentStatus = Number(form.status ?? script.status ?? 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={script.name}
        description={
          canViewAuthorizedUsers
            ? "维护脚本基础信息、价格策略和启用状态，右侧可查看当前 TradingView 授权用户名单。"
            : "维护脚本基础信息、价格策略和启用状态。授权用户名单仅管理员可查看。"
        }
        actions={
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "保存中..." : "保存修改"}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">脚本名称</label>
                <Input value={form.name ?? ""} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">版本</label>
                <Input value={script.version ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">月价</label>
                <Input
                  type="number"
                  value={Number(form.monthly_price ?? 0)}
                  onChange={(event) => setForm((state) => ({ ...state, monthly_price: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">试用天数</label>
                <Input
                  type="number"
                  value={Number(form.trial_days ?? 0)}
                  onChange={(event) => setForm((state) => ({ ...state, trial_days: Number(event.target.value) }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">季价</label>
                <Input
                  type="number"
                  value={Number(form.quarterly_price ?? 0)}
                  onChange={(event) => setForm((state) => ({ ...state, quarterly_price: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">年价</label>
                <Input
                  type="number"
                  value={Number(form.yearly_price ?? 0)}
                  onChange={(event) => setForm((state) => ({ ...state, yearly_price: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">永久价</label>
                <Input
                  type="number"
                  value={Number(form.lifetime_price ?? 0)}
                  onChange={(event) => setForm((state) => ({ ...state, lifetime_price: Number(event.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">启用状态</label>
              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-3">
                <ScriptStatusToggle
                  checked={currentStatus === 1}
                  pending={mutation.isPending}
                  onCheckedChange={(checked) => setForm((state) => ({ ...state, status: checked ? 1 : 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  停用后会阻止该脚本的新增授权、审核通过和直接续费；现有授权不受影响，会自然到期。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">描述</label>
              <Textarea value={form.description ?? ""} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>脚本属性</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <PropertyRow label="Pine ID" value={script.pine_id} />
              <PropertyRow label="类型" value={script.kind || "—"} />
              <PropertyRow label="状态" value={<StatusBadge status={currentStatus === 1 ? "active" : "disabled"} />} />
              <PropertyRow label="同步时间" value={formatDateTime(script.synced_at)} />
              <PropertyRow label="月价" value={formatCurrency(Number(form.monthly_price ?? script.monthly_price ?? 0))} />
            </CardContent>
          </Card>

          {canViewAuthorizedUsers ? (
            <AuthorizedUsersPanel
              users={usersQuery.data ?? []}
              loading={usersQuery.isLoading}
              refreshing={usersQuery.isFetching && !usersQuery.isLoading}
              onRefresh={() => usersQuery.refetch()}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
