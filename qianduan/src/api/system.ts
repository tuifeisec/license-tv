import { adminHttp, get, post, put } from "@/api/http";
import type {
  AccessAuditResult,
  AdminDashboardStats,
  OperationLog,
  PageResult,
  TVAccessSyncResult,
  TVAccessOverviewResult,
  TVSessionStatus,
} from "@/types/api";

export function getTVSessionStatus() {
  return get<TVSessionStatus>(adminHttp, "/system/tv-session");
}

export function updateTVCookies(payload: { sessionid: string; sessionid_sign: string }) {
  return put<{ updated: boolean }, typeof payload>(adminHttp, "/system/tv-cookies", payload);
}

export function syncAccessAudit() {
  return post<AccessAuditResult>(adminHttp, "/system/sync-access");
}

export function listOperationLogs(params?: { page?: number; page_size?: number; action?: string }) {
  return get<PageResult<OperationLog>>(adminHttp, "/system/operation-logs", { params });
}

export function getAdminDashboardStats() {
  return get<AdminDashboardStats>(adminHttp, "/dashboard/stats");
}

export function getTVAccessOverview(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  script_id?: string | number;
  access_status?: string;
  reconcile_status?: string;
}) {
  return get<TVAccessOverviewResult>(adminHttp, "/system/tv-access-overview", { params });
}

export function syncTVAccessSnapshot(payload?: { script_id?: number }) {
  return post<TVAccessSyncResult, typeof payload>(adminHttp, "/system/sync-tv-access", payload);
}
