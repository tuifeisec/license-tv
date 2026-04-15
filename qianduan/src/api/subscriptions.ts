import { adminHttp, get, post } from "@/api/http";
import type { PageResult, PlanType, Subscription } from "@/types/api";

export function listSubscriptions(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  script_id?: string | number;
  agent_id?: string | number;
  customer_keyword?: string;
}) {
  return get<PageResult<Subscription>>(adminHttp, "/subscriptions", { params });
}

export function getSubscription(id: string | number) {
  return get<Subscription>(adminHttp, `/subscriptions/${id}`);
}

export function createSubscription(payload: {
  customer_id: number;
  script_id: number;
  plan_type: PlanType;
  requested_days?: number;
}) {
  return post<Subscription, typeof payload>(adminHttp, "/subscriptions", payload);
}

export function renewSubscription(
  id: string | number,
  payload: {
    plan_type: PlanType;
    requested_days?: number;
  },
) {
  return post<{ renewed: true }, typeof payload>(adminHttp, `/subscriptions/${id}/renew`, payload);
}

export function revokeSubscription(id: string | number) {
  return post<{ revoked: true }>(adminHttp, `/subscriptions/${id}/revoke`);
}
