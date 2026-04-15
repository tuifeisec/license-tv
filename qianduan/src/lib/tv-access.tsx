import { Badge } from "@/components/ui/badge";
import type { ScriptAuthorizedUser } from "@/types/api";

export type TVAccessState = "active" | "expiring" | "expired" | "permanent";

export function getTVAccessState(item: Pick<ScriptAuthorizedUser, "expiration">): TVAccessState {
  if (!item.expiration) {
    return "permanent";
  }

  const expiration = new Date(item.expiration);
  if (Number.isNaN(expiration.getTime())) {
    return "active";
  }

  const diffMs = expiration.getTime() - Date.now();
  if (diffMs < 0) {
    return "expired";
  }
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) {
    return "expiring";
  }
  return "active";
}

export function renderTVAccessStateBadge(state: TVAccessState) {
  switch (state) {
    case "active":
      return <Badge variant="success">生效中</Badge>;
    case "expiring":
      return <Badge variant="warning">7 天内到期</Badge>;
    case "expired":
      return <Badge variant="destructive">已过期</Badge>;
    case "permanent":
      return <Badge>长期有效</Badge>;
  }
}

export function getTVAccessRemainingLabel(item: Pick<ScriptAuthorizedUser, "expiration">) {
  if (!item.expiration) {
    return "长期有效";
  }

  const expiration = new Date(item.expiration);
  if (Number.isNaN(expiration.getTime())) {
    return "—";
  }

  const diffDays = Math.ceil((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return `已超期 ${Math.abs(diffDays)} 天`;
  }
  if (diffDays === 0) {
    return "今天到期";
  }
  return `${diffDays} 天后到期`;
}
