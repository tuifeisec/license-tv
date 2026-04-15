import { adminHttp, get, post, put } from "@/api/http";
import type { AgentDetail, PageResult } from "@/types/api";

export function listAgents(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
  performance?: string;
  sort_by?: string;
  sort_order?: string;
}) {
  return get<PageResult<AgentDetail>>(adminHttp, "/agents", { params });
}

export function getAgent(id: string | number) {
  return get<AgentDetail>(adminHttp, `/agents/${id}`);
}

export function createAgent(payload: {
  username: string;
  password: string;
  display_name?: string;
  commission_rate?: number;
  status?: number;
}) {
  return post<AgentDetail, typeof payload>(adminHttp, "/agents", payload);
}

export function updateAgent(
  id: string | number,
  payload: {
    display_name?: string;
    commission_rate?: number;
    status?: number;
  },
) {
  return put<AgentDetail, typeof payload>(adminHttp, `/agents/${id}`, payload);
}

export function resetAgentPassword(id: string | number, payload: { new_password: string }) {
  return post<{ updated: true }, typeof payload>(adminHttp, `/agents/${id}/reset-password`, payload);
}
