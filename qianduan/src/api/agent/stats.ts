import { agentHttp, get } from "@/api/http";
import type { AgentDashboardStats } from "@/types/api";

export function getAgentDashboardStats() {
  return get<AgentDashboardStats>(agentHttp, "/stats");
}
