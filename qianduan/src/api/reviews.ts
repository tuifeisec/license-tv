import { adminHttp, get, post } from "@/api/http";
import type { AccessRequest, PageResult } from "@/types/api";

export function listReviews(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  script_id?: string | number;
}) {
  return get<PageResult<AccessRequest>>(adminHttp, "/reviews", { params });
}

export function getReview(id: string | number) {
  return get<AccessRequest>(adminHttp, `/reviews/${id}`);
}

export function approveReview(id: string | number) {
  return post<{ approved: boolean }>(adminHttp, `/reviews/${id}/approve`);
}

export function rejectReview(id: string | number, payload: { reason: string }) {
  return post<{ rejected: boolean }, typeof payload>(adminHttp, `/reviews/${id}/reject`, payload);
}

export function batchApproveReviews(payload: { ids: number[] }) {
  return post<{
    success_ids: number[];
    failed: Record<number, string>;
  }, typeof payload>(adminHttp, "/reviews/batch-approve", payload);
}
