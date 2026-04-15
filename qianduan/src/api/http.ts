import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth-store";
import { notify } from "@/store/ui-store";
import type { ApiEnvelope, AuthScope, TokenPair } from "@/types/api";

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  code: number;
  status?: number;
  payload?: unknown;

  constructor(message: string, code: number, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const refreshLocks: Record<AuthScope, Promise<void> | null> = {
  admin: null,
  agent: null,
};

function scopeBase(scope: AuthScope) {
  return `${apiBaseURL}/api/${scope}/v1`;
}

function createBaseClient(scope: AuthScope) {
  return axios.create({
    baseURL: scopeBase(scope),
    timeout: 30_000,
    withCredentials: true,
  });
}

const bareClients: Record<AuthScope, AxiosInstance> = {
  admin: createBaseClient("admin"),
  agent: createBaseClient("agent"),
};

function unwrap<T>(payload: ApiEnvelope<T>, status?: number) {
  if (payload.code !== 0) {
    throw new ApiError(payload.message || "请求失败", payload.code, status, payload.data);
  }
  return payload.data;
}

function normalizeError(error: AxiosError<ApiEnvelope<unknown>>) {
  if (error.response?.data) {
    try {
      unwrap(error.response.data, error.response.status);
    } catch (normalized) {
      return normalized;
    }
  }
  return error;
}

function buildSessionExpiredError() {
  return new ApiError("当前登录已过期，请重新登录。", 10006, 401);
}

function isRefreshable(error: unknown) {
  if (error instanceof ApiError) {
    return error.code === 10002 || error.code === 10006 || error.status === 401;
  }
  if (axios.isAxiosError(error)) {
    return error.response?.status === 401;
  }
  return false;
}

function notifyHttpError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 10002 || error.code === 10006) {
      notify({ title: "登录状态已失效", description: "当前会话已过期，请重新登录。", tone: "warning" });
      return;
    }
    if (error.code === 10003) {
      notify({ title: "权限不足", description: error.message, tone: "warning" });
      return;
    }
    if (error.code === 10100) {
      notify({ title: "TradingView 连接失效", description: "请更新 TV Cookie。", tone: "warning" });
      return;
    }
    if (error.code === 10999) {
      notify({ title: "服务器内部错误", description: "请稍后重试。", tone: "destructive" });
      return;
    }
    if (![10001, 10005, 10101, 10202, 10300].includes(error.code)) {
      notify({ title: "请求失败", description: error.message, tone: "destructive" });
    }
    return;
  }

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      notify({ title: "登录状态已失效", description: "当前会话已过期，请重新登录。", tone: "warning" });
      return;
    }
    notify({ title: "网络连接失败", description: error.message, tone: "destructive" });
    return;
  }

  notify({ title: "请求失败", description: "发生未知错误", tone: "destructive" });
}

async function refreshToken(scope: AuthScope) {
  if (refreshLocks[scope]) {
    return refreshLocks[scope]!;
  }

  const state = useAuthStore.getState();
  if (state.authScope !== scope) {
    state.clearSession();
    throw buildSessionExpiredError();
  }

  refreshLocks[scope] = bareClients[scope]
    .post<ApiEnvelope<TokenPair>>("/auth/refresh")
    .then((response) => unwrap(response.data, response.status))
    .then((data) => {
      useAuthStore.getState().setSession(data, scope);
    })
    .catch((error: AxiosError<ApiEnvelope<unknown>> | unknown) => {
      useAuthStore.getState().clearSession();
      queryClient.clear();

      if (axios.isAxiosError(error)) {
        const normalized = normalizeError(error);
        if (normalized instanceof ApiError && normalized.code === 10001) {
          throw buildSessionExpiredError();
        }
        throw normalized;
      }

      throw error;
    })
    .finally(() => {
      refreshLocks[scope] = null;
    });

  return refreshLocks[scope]!;
}

function buildScopedClient(scope: AuthScope) {
  const client = createBaseClient(scope);

  client.interceptors.response.use(
    (response) => unwrap(response.data, response.status),
    async (error: AxiosError<ApiEnvelope<unknown>>) => {
      const original = error.config as RetriableConfig | undefined;
      const normalized = normalizeError(error);
      const isRefreshCall = original?.url?.includes("/auth/refresh");
      const isLoginCall = original?.url?.includes("/auth/login");

      if (original && !original._retry && !isRefreshCall && !isLoginCall && isRefreshable(normalized)) {
        original._retry = true;
        try {
          await refreshToken(scope);
          return client(original);
        } catch (refreshError) {
          notifyHttpError(refreshError);
          throw refreshError;
        }
      }

      notifyHttpError(normalized);
      throw normalized;
    },
  );

  return client;
}

export const adminHttp = buildScopedClient("admin");
export const agentHttp = buildScopedClient("agent");
export const adminAuthHttp = bareClients.admin;
export const agentAuthHttp = bareClients.agent;

export async function get<T>(client: AxiosInstance, url: string, config?: AxiosRequestConfig) {
  return client.get<T>(url, config) as Promise<T>;
}

export async function post<T, B = unknown>(
  client: AxiosInstance,
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
) {
  return client.post<T>(url, body, config) as Promise<T>;
}

export async function put<T, B = unknown>(
  client: AxiosInstance,
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
) {
  return client.put<T>(url, body, config) as Promise<T>;
}
