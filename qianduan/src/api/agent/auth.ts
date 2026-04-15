import { agentAuthHttp, agentHttp, ApiError, get, post, put } from "@/api/http";
import type { ApiEnvelope, ChangePasswordResult, CurrentProfile, TokenPair } from "@/types/api";

export async function loginAgent(payload: { username: string; password: string }) {
  const response = await agentAuthHttp.post<ApiEnvelope<TokenPair>>("/auth/login", payload);
  const envelope = response.data;
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || "登录失败", envelope.code, response.status, envelope.data);
  }
  return envelope.data;
}

export async function refreshAgent(payload: { refresh_token: string }) {
  const response = await agentAuthHttp.post<ApiEnvelope<TokenPair>>("/auth/refresh", payload);
  const envelope = response.data;
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || "刷新失败", envelope.code, response.status, envelope.data);
  }
  return envelope.data;
}

export function logoutAgent() {
  return post<{ logged_out: boolean }>(agentAuthHttp, "/auth/logout");
}

export async function changeAgentPassword(payload: { old_password: string; new_password: string }) {
  return put<ChangePasswordResult, typeof payload>(agentHttp, "/auth/password", payload);
}

export function getAgentProfile() {
  return get<CurrentProfile>(agentHttp, "/auth/profile");
}

export function updateAgentProfile(payload: { display_name: string }) {
  return put<CurrentProfile, typeof payload>(agentHttp, "/auth/profile", payload);
}
