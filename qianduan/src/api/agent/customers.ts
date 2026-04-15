import { agentHttp, get, post, put } from "@/api/http";
import type { Customer, CustomerDetail, CustomerListItem, PageResult, TVUserHint } from "@/types/api";

export function listAgentCustomers(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  subscription_status?: "active" | "expiring_soon" | "no_subscription" | "pending";
}) {
  return get<PageResult<CustomerListItem>>(agentHttp, "/customers", { params });
}

export function getAgentCustomer(id: string | number) {
  return get<CustomerDetail>(agentHttp, `/customers/${id}`);
}

export function createAgentCustomer(payload: {
  tv_username: string;
  contact?: string;
  remark?: string;
}) {
  return post<Customer, typeof payload>(agentHttp, "/customers", payload);
}

export function updateAgentCustomer(
  id: string | number,
  payload: {
    contact?: string;
    remark?: string;
  },
) {
  return put<Customer, typeof payload>(agentHttp, `/customers/${id}`, payload);
}

export function validateAgentTVUsername(keyword: string) {
  return get<TVUserHint[]>(agentHttp, "/tv/validate-username", {
    params: { keyword },
  });
}
