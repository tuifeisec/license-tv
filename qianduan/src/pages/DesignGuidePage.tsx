import { ShieldCheck, TriangleAlert } from "lucide-react";

import { AuditReportTable } from "@/components/AuditReportTable";
import { CookieStatusCard } from "@/components/CookieStatusCard";
import { DataTable, type TableColumn } from "@/components/DataTable";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { PlanTypeBadge } from "@/components/PlanTypeBadge";
import { PropertyRow } from "@/components/PropertyRow";
import { ScriptStatusToggle } from "@/components/ScriptStatusToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { TVUsernameInput } from "@/components/TVUsernameInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Subscription } from "@/types/api";

const sampleColumns: TableColumn<Subscription>[] = [
  { key: "script", header: "脚本", render: (item) => item.script?.name ?? "—" },
  { key: "plan", header: "套餐", render: (item) => <PlanTypeBadge value={item.plan_type} /> },
  { key: "status", header: "状态", render: (item) => <StatusBadge status={item.status} /> },
];

export function DesignGuidePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="设计规范展示板"
        description="新增的可复用组件先在这里展示，再进入业务页面，保证视觉、密度和交互规则始终一致。"
        actions={
          <>
            <Button variant="outline">次级操作</Button>
            <Button>主操作</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShieldCheck} value={128} label="活跃订阅" description="控制台标准 MetricCard" />
        <MetricCard icon={TriangleAlert} value={6} label="待处理异常" description="强调少量但关键的异常数据" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>状态与属性</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="pending" />
              <StatusBadge status="approved" />
              <StatusBadge status="rejected" />
              <StatusBadge status="disabled" />
              <PlanTypeBadge value="monthly" />
              <PlanTypeBadge value="trial" />
            </div>
            <div className="flex flex-wrap gap-3">
              <ScriptStatusToggle checked onCheckedChange={() => undefined} />
              <ScriptStatusToggle checked={false} onCheckedChange={() => undefined} />
            </div>
            <div className="space-y-1">
              <PropertyRow label="TV Session" value={<StatusBadge status="approved" />} />
              <PropertyRow label="脚本套餐" value={<PlanTypeBadge value="yearly" />} />
              <PropertyRow label="客户备注" value="长期续费客户" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>交互输入</CardTitle>
          </CardHeader>
          <CardContent>
            <TVUsernameInput
              value=""
              onChange={() => undefined}
              validator={async () => []}
              placeholder="TVUsernameInput 交互示例"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>DataTable 模式</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <DataTable
              data={[
                {
                  id: 1,
                  customer_id: 1,
                  script_id: 1,
                  plan_type: "yearly",
                  status: "active",
                  tv_granted: true,
                  started_at: "",
                  customer: { id: 1, tv_username: "sample_user", contact: "", remark: "" },
                  script: {
                    id: 1,
                    pine_id: "PUB;sample",
                    name: "ALGO Master",
                    description: "",
                    kind: "study",
                    version: "1.0",
                    monthly_price: 199,
                    quarterly_price: 499,
                    yearly_price: 1299,
                    lifetime_price: 3999,
                    trial_days: 7,
                    status: 1,
                  },
                },
              ]}
              columns={sampleColumns}
              keyExtractor={(item) => item.id}
            />
          </CardContent>
        </Card>

        <CookieStatusCard
          data={{
            status: {
              configured: true,
              sessionid_masked: "abcd****wxyz",
              sessionid_sign_masked: "1234****7890",
            },
            valid: true,
            account: { username: "demo" },
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>对账结果表</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <AuditReportTable
            entries={[
              {
                script_id: 1,
                script_name: "ALGO Master",
                tv_user_count: 18,
                db_active_count: 17,
                missing_on_tv: ["vip_user"],
                extra_on_tv: [],
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
