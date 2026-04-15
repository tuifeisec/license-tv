import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createAgentRequest } from "@/api/agent/requests";
import { PageHeader } from "@/components/PageHeader";
import { PaymentProofUploader } from "@/components/PaymentProofUploader";
import { PlanTypeSelect } from "@/components/PlanTypeSelect";
import { ScriptSelect } from "@/components/ScriptSelect";
import { TVUsernameInput } from "@/components/TVUsernameInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TRADINGVIEW_REGISTER_URL } from "@/lib/tradingview";
import { notify } from "@/store/ui-store";

const schema = z.object({
  tv_username: z.string().min(2, "请输入 TV 用户名"),
  contact: z.string().optional(),
  remark: z.string().optional(),
  script_id: z.string().min(1, "请选择脚本"),
  plan_type: z.string().min(1, "请选择套餐"),
  amount: z.coerce.number().min(0, "金额不能小于 0"),
  payment_proof: z.string().min(1, "请上传付款凭证"),
  requested_days: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

function parseNumericParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AgentRequestCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tv_username: "",
      contact: "",
      remark: "",
      script_id: "",
      plan_type: "monthly",
      amount: 0,
      payment_proof: "",
      requested_days: 0,
    },
  });

  useEffect(() => {
    const textFields: Array<keyof Pick<FormValues, "tv_username" | "contact" | "remark" | "script_id" | "plan_type">> = [
      "tv_username",
      "contact",
      "remark",
      "script_id",
      "plan_type",
    ];

    textFields.forEach((field) => {
      const value = searchParams.get(field);
      if (value !== null) {
        setValue(field, value, { shouldValidate: false, shouldDirty: false });
      }
    });

    const amount = parseNumericParam(searchParams.get("amount"));
    if (amount !== null) {
      setValue("amount", amount, { shouldValidate: false, shouldDirty: false });
    }

    const requestedDays = parseNumericParam(searchParams.get("requested_days"));
    if (requestedDays !== null) {
      setValue("requested_days", requestedDays, { shouldValidate: false, shouldDirty: false });
    }
  }, [searchParams, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAgentRequest({
        tv_username: values.tv_username,
        contact: values.contact,
        remark: values.remark,
        script_id: Number(values.script_id),
        action: "new",
        plan_type: values.plan_type as "monthly" | "quarterly" | "yearly" | "lifetime" | "trial",
        amount: Number(values.amount),
        payment_proof: values.payment_proof,
        requested_days: Number(values.requested_days || 0),
      }),
    onSuccess: (result) => {
      notify({ title: "申请已提交", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["agent-requests"] });
      navigate(`/agent/requests/${result.id}`);
    },
  });

  const openRegisterLink = () => {
    window.open(TRADINGVIEW_REGISTER_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="提交申请"
        description="填写客户、脚本、套餐和付款凭证后即可提交审核。代理端不做用户名校验，最终校验在管理员通过前完成。"
        actions={
          <Button variant="outline" onClick={() => navigate("/agent/tv-register")}>
            注册 TradingView
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>申请表单</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground">TV 用户名</label>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => navigate("/agent/tv-register")}
                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    还没有账号？先走注册流程
                  </button>
                  <button
                    type="button"
                    onClick={openRegisterLink}
                    className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    打开注册链接
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              </div>
              <TVUsernameInput
                value={watch("tv_username")}
                onChange={(value) => setValue("tv_username", value, { shouldValidate: true })}
              />
              {errors.tv_username ? <p className="text-xs text-destructive">{errors.tv_username.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">脚本</label>
              <ScriptSelect value={watch("script_id")} onChange={(value) => setValue("script_id", value, { shouldValidate: true })} scope="agent" />
              {errors.script_id ? <p className="text-xs text-destructive">{errors.script_id.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">套餐</label>
              <PlanTypeSelect value={watch("plan_type")} onChange={(value) => setValue("plan_type", value, { shouldValidate: true })} />
              {errors.plan_type ? <p className="text-xs text-destructive">{errors.plan_type.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">金额</label>
              <Input type="number" step="0.01" {...register("amount")} />
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">自定义天数</label>
              <Input type="number" {...register("requested_days")} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">联系方式</label>
              <Input {...register("contact")} placeholder="wechat: demo" />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">备注</label>
              <Textarea {...register("remark")} placeholder="例如：首次购买、客户要求尽快处理" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <PaymentProofUploader
                value={watch("payment_proof")}
                onChange={(value) => setValue("payment_proof", value, { shouldValidate: true, shouldDirty: true })}
                disabled={isSubmitting || mutation.isPending}
              />
              {errors.payment_proof ? <p className="text-xs text-destructive">{errors.payment_proof.message}</p> : null}
            </div>

            <div className="md:col-span-2 flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => navigate("/agent/requests")}>
                返回列表
              </Button>
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isSubmitting || mutation.isPending ? "提交中..." : "提交申请"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
