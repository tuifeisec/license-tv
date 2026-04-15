import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { loginAgent } from "@/api/agent/auth";
import { loginAdmin } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { homePathForRole } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";
import type { AuthScope } from "@/types/api";

const schema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

type FormValues = z.infer<typeof schema>;

const signalRows = [
  { label: "ACCESS GRID", value: "ONLINE" },
  { label: "COOKIE LINK", value: "READY" },
  { label: "AUDIT TRACE", value: "TRACKED" },
];

async function loginByScope(values: FormValues): Promise<{ scope: AuthScope; result: Awaited<ReturnType<typeof loginAdmin>> }> {
  try {
    const adminResult = await loginAdmin(values);
    return { scope: "admin", result: adminResult };
  } catch (adminError) {
    try {
      const agentResult = await loginAgent(values);
      return { scope: "agent", result: agentResult };
    } catch {
      throw adminError;
    }
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const setSession = useAuthStore((state) => state.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      const { scope, result } = await loginByScope(values);
      setSession(result, scope);
      const redirect = searchParams.get("redirect");
      navigate(redirect || homePathForRole(result.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute inset-0 opacity-40 surface-grid" />
      </div>

      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            AI Access Console
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              TradingView
              <span className="block text-primary">智能接入入口</span>
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              用更少的步骤进入工作台，把授权、对账与运营动作留在真正需要发生的地方。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-card/65">
              <CardContent className="space-y-2 py-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Access</div>
                <div className="text-lg font-semibold">权限接入</div>
              </CardContent>
            </Card>
            <Card className="bg-card/65">
              <CardContent className="space-y-2 py-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Session</div>
                <div className="text-lg font-semibold">会话校验</div>
              </CardContent>
            </Card>
            <Card className="bg-card/65">
              <CardContent className="space-y-2 py-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Trace</div>
                <div className="text-lg font-semibold">安全留痕</div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden bg-card/60">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">System Signals</div>
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-success shadow-[0_0_12px_rgba(81,207,136,0.55)]" />
                  Live
                </div>
              </div>
              <div className="space-y-2">
                {signalRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto w-full max-w-md overflow-hidden border-border/80 bg-card/88 backdrop-blur-xl">
          <CardContent className="space-y-6 p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Secure Login
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">进入工作台</h2>
                  <p className="mt-1 text-sm text-muted-foreground">完成校验后即可继续。</p>
                </div>
              </div>

              <div className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-primary shadow-sm">
                <LockKeyhole className="size-5" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/45 px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Workspace Access</div>
                <div className="mt-1 text-sm font-medium">使用已分配账号凭证登录</div>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-success shadow-[0_0_12px_rgba(81,207,136,0.55)]" />
                Protected
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">用户名</label>
                <Input
                  {...register("username")}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  className="h-11 rounded-xl bg-background/55"
                />
                {errors.username ? <p className="text-xs text-destructive">{errors.username.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">密码</label>
                <Input
                  {...register("password")}
                  type="password"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  className="h-11 rounded-xl bg-background/55"
                />
                {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
              </div>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" disabled={isSubmitting}>
                {isSubmitting ? "校验中..." : "进入系统"}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="flex items-center justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground">
              <span>Login Mode</span>
              <span className="font-mono tracking-[0.18em]">SECURE ACCESS</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
