import { adminHttp, get, post, put } from "@/api/http";
import type { PageResult, Script, ScriptAuthorizedUser } from "@/types/api";

export function listScripts(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  active_only?: boolean;
  status?: "enabled" | "disabled";
}) {
  return get<PageResult<Script>>(adminHttp, "/scripts", { params });
}

export function getScript(id: string | number) {
  return get<Script>(adminHttp, `/scripts/${id}`);
}

export function updateScript(
  id: string | number,
  payload: Partial<
    Pick<
      Script,
      | "name"
      | "description"
      | "monthly_price"
      | "quarterly_price"
      | "yearly_price"
      | "lifetime_price"
      | "trial_days"
      | "status"
    >
  >,
) {
  return put<Script, typeof payload>(adminHttp, `/scripts/${id}`, payload);
}

export function syncScripts() {
  return post<{ synced: number }>(adminHttp, "/scripts/sync");
}

export function getScriptUsers(id: string | number) {
  return get<ScriptAuthorizedUser[]>(adminHttp, `/scripts/${id}/users`);
}
