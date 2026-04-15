import { adminAuthHttp, adminHttp, ApiError, get, post, put } from "@/api/http";
import type { ApiEnvelope, ChangePasswordResult, CurrentProfile, TokenPair } from "@/types/api";

export async function loginAdmin(payload: { username: string; password: string }) {
  const response = await adminAuthHttp.post<ApiEnvelope<TokenPair>>("/auth/login", payload);
  const envelope = response.data;
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || "登录失败", envelope.code, response.status, envelope.data);
  }
  return envelope.data;
}

export async function refreshAdmin(payload: { refresh_token: string }) {
  const response = await adminAuthHttp.post<ApiEnvelope<TokenPair>>("/auth/refresh", payload);
  const envelope = response.data;
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || "刷新失败", envelope.code, response.status, envelope.data);
  }
  return envelope.data;
}

export function logoutAdmin() {
  return post<{ logged_out: boolean }>(adminAuthHttp, "/auth/logout");
}

export async function changeAdminPassword(payload: { old_password: string; new_password: string }) {
  return put<ChangePasswordResult, typeof payload>(adminHttp, "/auth/password", payload);
}

export function getAdminProfile() {
  return get<CurrentProfile>(adminHttp, "/auth/profile");
}

export function updateAdminProfile(payload: { display_name: string }) {
  return put<CurrentProfile, typeof payload>(adminHttp, "/auth/profile", payload);
}
