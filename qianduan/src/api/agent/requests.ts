import { agentHttp, get, post } from "@/api/http";
import type { AccessRequest, PageResult, PlanType, RequestAction } from "@/types/api";

export function listAgentRequests(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  script_id?: string | number;
}) {
  return get<PageResult<AccessRequest>>(agentHttp, "/requests", { params });
}

export function getAgentRequest(id: string | number) {
  return get<AccessRequest>(agentHttp, `/requests/${id}`);
}

export function createAgentRequest(payload: {
  customer_id?: number;
  tv_username?: string;
  contact?: string;
  remark?: string;
  script_id: number;
  action: RequestAction;
  plan_type: PlanType;
  requested_days?: number;
  amount: number;
  payment_proof: string;
}) {
  return post<AccessRequest, typeof payload>(agentHttp, "/requests", payload);
}

export function uploadAgentPaymentProof(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return post<{
    url: string;
    path: string;
    content_type: string;
    size: number;
  }, FormData>(agentHttp, "/uploads/payment-proof", formData);
}

export function cancelAgentRequest(id: string | number) {
  return post<{ cancelled: true }>(agentHttp, `/requests/${id}/cancel`);
}
