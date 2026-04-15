import { agentHttp, get } from "@/api/http";
import type { PageResult, Script } from "@/types/api";

export function listAgentScripts(params?: {
  page?: number;
  page_size?: number;
 keyword?: string;
}) {
  return get<PageResult<Script>>(agentHttp, "/scripts", { params });
}
