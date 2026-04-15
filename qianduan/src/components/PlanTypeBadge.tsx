import { Badge } from "@/components/ui/badge";
import type { PlanType } from "@/types/api";

const labelMap: Record<PlanType, string> = {
  monthly: "月付",
  quarterly: "季付",
  yearly: "年付",
  lifetime: "永久",
  trial: "试用",
};

export function PlanTypeBadge({ value }: { value: PlanType }) {
  return <Badge variant={value === "trial" ? "warning" : "default"}>{labelMap[value] ?? value}</Badge>;
}
