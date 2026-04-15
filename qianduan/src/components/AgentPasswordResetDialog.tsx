import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentDetail } from "@/types/api";

export function AgentPasswordResetDialog({
  open,
  agent,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  agent: AgentDetail | null;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setPassword("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="重置代理密码"
      description={agent ? `为 ${agent.display_name || agent.username} 设置一个新的登录密码。` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSubmit(password)} disabled={pending || password.length < 6}>
            {pending ? "保存中..." : "确认重置"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">新密码至少 6 位，重置后代理将使用新密码登录。</div>
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入新密码" />
      </div>
    </Dialog>
  );
}
