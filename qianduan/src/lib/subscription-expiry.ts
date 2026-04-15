import type { PlanType } from "@/types/api";

export type ExpiryLevel = "normal" | "warning" | "critical" | "lifetime";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getExpiryLevel(expiresAt: string | null | undefined, planType: PlanType): ExpiryLevel {
  if (planType === "lifetime" || !expiresAt) {
    return "lifetime";
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return "normal";
  }

  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  if (days <= 3) {
    return "critical";
  }
  if (days <= 7) {
    return "warning";
  }
  return "normal";
}

export function isExpiringSoon(expiresAt: string | null | undefined, planType: PlanType) {
  const level = getExpiryLevel(expiresAt, planType);
  return level === "warning" || level === "critical";
}
