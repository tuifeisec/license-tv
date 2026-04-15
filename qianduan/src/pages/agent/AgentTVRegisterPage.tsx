import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { TVUsernameInput } from "@/components/TVUsernameInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TRADINGVIEW_REGISTER_URL } from "@/lib/tradingview";

function buildRequestPath(params: { tvUsername: string; contact: string; remark: string }) {
  const search = new URLSearchParams();
  if (params.tvUsername.trim()) {
    search.set("tv_username", params.tvUsername.trim());
  }
  if (params.contact.trim()) {
    search.set("contact", params.contact.trim());
  }
  if (params.remark.trim()) {
    search.set("remark", params.remark.trim());
  }
  const query = search.toString();
  return query ? `/agent/requests/new?${query}` : "/agent/requests/new";
}

function buildCustomerPath(params: { tvUsername: string; contact: string; remark: string }) {
  const search = new URLSearchParams();
  if (params.tvUsername.trim()) {
    search.set("tv_username", params.tvUsername.trim());
  }
  if (params.contact.trim()) {
    search.set("contact", params.contact.trim());
  }
  if (params.remark.trim()) {
    search.set("remark", params.remark.trim());
  }
  const query = search.toString();
  return query ? `/agent/customers?${query}` : "/agent/customers";
}

function StepRow({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/70 bg-background/35 px-3 py-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-[11px] font-semibold text-muted-foreground">
        {index}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function AgentTVRegisterPage() {
  const navigate = useNavigate();
  const [tvUsername, setTvUsername] = useState("");
  const [contact, setContact] = useState("");
  const [remark, setRemark] = useState("");

  const trimmedUsername = tvUsername.trim();
  const hasContact = contact.trim().length > 0;
  const canContinue = trimmedUsername.length >= 2;

  const requestPath = useMemo(
    () =>
      buildRequestPath({
        tvUsername,
        contact,
        remark,
      }),
    [contact, remark, tvUsername],
  );

  const customerPath = useMemo(
    () =>
      buildCustomerPath({
        tvUsername,
        contact,
        remark,
      }),
    [contact, remark, tvUsername],
  );

  const openRegisterLink = () => {
    window.open(TRADINGVIEW_REGISTER_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="注册 TradingView"
        description="给还没有 TV 账号的客户使用，注册完成后回填用户名并继续进入客户或申请流程。"
        actions={
          <Button onClick={openRegisterLink}>
            打开注册链接
            <ExternalLink className="size-4" />
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>快速流程</CardTitle>
            <CardDescription>只做注册引导，不承载额外业务说明。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepRow
              index="01"
              title="打开注册链接"
              description="让客户从统一入口完成 TradingView 注册。"
            />
            <StepRow
              index="02"
              title="回收 TV 用户名"
              description="后续建客户、提申请都以 TV 用户名为准。"
            />
            <StepRow
              index="03"
              title="继续后续流程"
              description="用户名确认后，再去客户台账或申请页。"
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={canContinue ? "success" : "warning"}>
                {canContinue ? "用户名已可继续" : "先回填用户名"}
              </Badge>
              {hasContact ? <Badge variant="outline">已补联系方式</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>回填信息</CardTitle>
            <CardDescription>确认用户名后，决定进入客户台账还是直接提交申请。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs text-muted-foreground">TV 用户名</label>
                  <button
                    type="button"
                    onClick={openRegisterLink}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    打开注册链接
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
                <TVUsernameInput
                  value={tvUsername}
                  onChange={setTvUsername}
                  placeholder="注册完成后回填 TV 用户名"
                  hintLabel="匹配到的用户名"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">联系方式</label>
                <Input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="wechat / telegram / email"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs text-muted-foreground">备注</label>
                <Textarea
                  rows={3}
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  placeholder="例如：今天新注册，待继续跟进"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={openRegisterLink}>
                  重新打开注册链接
                </Button>
                <Button variant="outline" onClick={() => navigate(customerPath)} disabled={!canContinue}>
                  先去客户台账
                </Button>
                <Button onClick={() => navigate(requestPath)} disabled={!canContinue}>
                  直接去提交申请
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
