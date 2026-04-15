import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function RejectDialog({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="拒绝申请"
      description="请填写拒绝原因，系统会记录在审核详情中。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={() => onSubmit(reason)} disabled={pending || !reason.trim()}>
            {pending ? "处理中..." : "确认拒绝"}
          </Button>
        </>
      }
    >
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="例如：付款凭证不清晰、金额不匹配、套餐信息有误"
      />
    </Dialog>
  );
}
