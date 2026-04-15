import { Badge } from "@/components/ui/badge";

export function PaymentProofStatusBadge({ value }: { value?: string | null }) {
  if (value) {
    return <Badge variant="success">已上传</Badge>;
  }
  return <Badge variant="warning">缺凭证</Badge>;
}
