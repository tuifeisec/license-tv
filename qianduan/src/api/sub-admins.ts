import { adminHttp, get, post, put } from "@/api/http";
import type { PageResult, SubAdminDetail, SubAdminSummary } from "@/types/api";

export function listSubAdmins(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}) {
  return get<PageResult<SubAdminSummary>>(adminHttp, "/sub-admins", { params });
}

export function getSubAdmin(id: string | number) {
  return get<SubAdminDetail>(adminHttp, `/sub-admins/${id}`);
}

export function createSubAdmin(payload: {
  username: string;
  password: string;
  display_name?: string;
  status?: number;
  script_ids?: number[];
}) {
  return post<SubAdminSummary, typeof payload>(adminHttp, "/sub-admins", payload);
}

export function updateSubAdmin(
  id: string | number,
  payload: {
    display_name?: string;
    status?: number;
  },
) {
  return put<SubAdminSummary, typeof payload>(adminHttp, `/sub-admins/${id}`, payload);
}

export function resetSubAdminPassword(id: string | number, payload: { new_password: string }) {
  return post<{ updated: true }, typeof payload>(adminHttp, `/sub-admins/${id}/reset-password`, payload);
}

export function updateSubAdminScripts(id: string | number, payload: { script_ids: number[] }) {
  return put<{ updated: true }, typeof payload>(adminHttp, `/sub-admins/${id}/scripts`, payload);
}
