import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SubAdminSummary } from "@/types/api";

export function SubAdminPasswordResetDialog({
  open,
  subAdmin,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  subAdmin: SubAdminSummary | null;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="重置管理员密码"
      description={subAdmin ? `为 ${subAdmin.display_name || subAdmin.username} 设置新的登录密码。` : undefined}
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
        <div className="text-xs text-muted-foreground">新密码至少 6 位。重置后，管理员将使用新密码重新登录。</div>
        <Input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="请输入新密码"
        />
      </div>
    </Dialog>
  );
}
