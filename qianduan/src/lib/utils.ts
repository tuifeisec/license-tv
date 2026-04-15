import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return "长期有效";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function relativeTime(value?: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

  if (Math.abs(diffMin) < 60) {
    return formatter.format(diffMin, "minute");
  }

  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return formatter.format(diffDays, "day");
  }

  return formatDate(date);
}

export function initials(name?: string) {
  if (!name) {
    return "TV";
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
}

export function parseOperationDetail(input: unknown) {
  if (!input) {
    return "";
  }
  if (typeof input === "string") {
    try {
      return JSON.stringify(JSON.parse(atob(input)), null, 2);
    } catch {
      return input;
    }
  }
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function toOptions<T extends Record<string, unknown>>(
  list: T[],
  valueKey: keyof T,
  labelKey: keyof T,
) {
  return list.map((item) => ({
    value: String(item[valueKey] ?? ""),
    label: String(item[labelKey] ?? ""),
  }));
}
