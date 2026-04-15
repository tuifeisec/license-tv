import { adminHttp, get, post, put } from "@/api/http";
import type { Customer, CustomerDetail, PageResult, TVUserHint } from "@/types/api";

export function listCustomers(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
}) {
  return get<PageResult<Customer>>(adminHttp, "/customers", { params });
}

export function getCustomer(id: string | number) {
  return get<CustomerDetail>(adminHttp, `/customers/${id}`);
}

export function createCustomer(payload: {
  tv_username: string;
  contact?: string;
  remark?: string;
  agent_id?: number;
}) {
  return post<Customer, typeof payload>(adminHttp, "/customers", payload);
}

export function updateCustomer(
  id: string | number,
  payload: {
    contact?: string;
    remark?: string;
  },
) {
  return put<Customer, typeof payload>(adminHttp, `/customers/${id}`, payload);
}

export function validateTVUsername(keyword: string) {
  return get<TVUserHint[]>(adminHttp, "/tv/validate-username", {
    params: { keyword },
  });
}
