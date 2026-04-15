import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { changeAgentPassword, getAgentProfile, updateAgentProfile } from "@/api/agent/auth";
import { changeAdminPassword, getAdminProfile, updateAdminProfile } from "@/api/auth";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PropertyRow } from "@/components/PropertyRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { notify } from "@/store/ui-store";
import type { CurrentProfile, Role } from "@/types/api";

function roleLabel(role?: Role) {
  switch (role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "sub_admin":
      return "管理员";
    case "agent":
      return "代理";
    default:
      return "未知角色";
  }
}

function statusLabel(status?: number) {
  return status === 1 ? "启用" : "禁用";
}

export function ProfilePage() {
  const authScope = useAuthStore((state) => state.authScope);
  const sessionUser = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [displayName, setDisplayName] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const query = useQuery({
    queryKey: ["current-profile", authScope],
    queryFn: () => (authScope === "agent" ? getAgentProfile() : getAdminProfile()),
    enabled: Boolean(authScope),
  });

  useEffect(() => {
    if (query.data) {
      setDisplayName(query.data.display_name ?? "");
    }
  }, [query.data]);

  const profile = query.data;
  const passwordMismatch = passwordForm.new_password !== passwordForm.confirm_password;
  const passwordUnchanged = passwordForm.old_password !== "" && passwordForm.old_password === passwordForm.new_password;

  const profileMutation = useMutation({
    mutationFn: (payload: { display_name: string }) =>
      authScope === "agent" ? updateAgentProfile(payload) : updateAdminProfile(payload),
    onSuccess: (result) => {
      updateUser({
        id: result.id,
        username: result.username,
        role: result.role,
        display_name: result.display_name,
        commission_rate: result.commission_rate,
        status: result.status,
      });
      notify({ title: "个人资料已更新", tone: "success" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (payload: { old_password: string; new_password: string }) =>
      authScope === "agent" ? changeAgentPassword(payload) : changeAdminPassword(payload),
    onSuccess: (result) => {
      if (result.session && authScope) {
        setSession(result.session, authScope);
      }
      notify({
        title: "登录密码已更新",
        description: result.other_sessions_invalidated ? "其他旧会话已被强制失效。" : undefined,
        tone: "success",
      });
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    },
  });

  const securityTips = useMemo(() => {
    const tips = [
      "密码建议至少 8 位，并混合使用大小写字母、数字和符号。",
      "高权限账户不要与日常测试账号共用密码。",
      "修改资料后，侧边身份卡片和业务页面会同步显示最新名称。",
    ];

    if (profile?.role === "super_admin") {
      tips.unshift("超级管理员拥有最高权限，建议仅限核心运维人员持有。");
    }

    return tips;
  }, [profile?.role]);

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  const currentProfile = (profile ?? sessionUser) as CurrentProfile | null;
  if (!currentProfile) {
    return <PageSkeleton variant="detail" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="个人中心" description="管理当前登录账号的基础资料与账户安全设置。" />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={UserRound} value={roleLabel(currentProfile.role)} label="当前角色" />
        <MetricCard icon={ShieldCheck} value={statusLabel(currentProfile.status)} label="账号状态" />
        <MetricCard icon={KeyRound} value={currentProfile.username} label="登录账号" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>基础资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="space-y-1">
                <PropertyRow label="用户名" value={currentProfile.username} />
                <PropertyRow label="角色" value={<Badge variant="outline">{roleLabel(currentProfile.role)}</Badge>} />
                <PropertyRow
                  label="状态"
                  value={<Badge variant={currentProfile.status === 1 ? "success" : "destructive"}>{statusLabel(currentProfile.status)}</Badge>}
                />
                <PropertyRow label="创建时间" value={formatDateTime(currentProfile.created_at)} />
                <PropertyRow label="最后更新" value={formatDateTime(currentProfile.updated_at)} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">显示名称</div>
                <p className="text-sm text-muted-foreground">显示名称会同步到侧边身份卡片和业务页面展示中。</p>
              </div>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="请输入显示名称" />
              <Button
                onClick={() => profileMutation.mutate({ display_name: displayName.trim() })}
                disabled={profileMutation.isPending || displayName.trim().length === 0}
              >
                {profileMutation.isPending ? "保存中..." : "保存资料"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              value={passwordForm.old_password}
              onChange={(event) => setPasswordForm((state) => ({ ...state, old_password: event.target.value }))}
              placeholder="当前密码"
            />
            <Input
              type="password"
              value={passwordForm.new_password}
              onChange={(event) => setPasswordForm((state) => ({ ...state, new_password: event.target.value }))}
              placeholder="新密码，至少 6 位"
            />
            <Input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(event) => setPasswordForm((state) => ({ ...state, confirm_password: event.target.value }))}
              placeholder="确认新密码"
            />
            {passwordMismatch ? <p className="text-xs text-destructive">两次输入的新密码不一致。</p> : null}
            {passwordUnchanged ? <p className="text-xs text-destructive">新密码不能与当前密码相同。</p> : null}
            <Button
              onClick={() =>
                passwordMutation.mutate({
                  old_password: passwordForm.old_password,
                  new_password: passwordForm.new_password,
                })
              }
              disabled={
                passwordMutation.isPending ||
                passwordForm.old_password.length === 0 ||
                passwordForm.new_password.length < 6 ||
                passwordMismatch ||
                passwordUnchanged
              }
            >
              {passwordMutation.isPending ? "更新中..." : "更新密码"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>安全提示</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {securityTips.map((tip) => (
            <div key={tip} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
              {tip}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
