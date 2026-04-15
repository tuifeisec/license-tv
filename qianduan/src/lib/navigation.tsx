import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Bot,
  Building2,
  ClipboardCheck,
  Globe,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  ShieldUser,
  UserCog,
  Users,
} from "lucide-react";

import type { Role } from "@/types/api";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
}

export const navItems: NavItem[] = [
  { label: "总览看板", path: "/dashboard", icon: LayoutDashboard, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "脚本管理", path: "/scripts", icon: Bot, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "审核中心", path: "/reviews", icon: ClipboardCheck, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "订阅管理", path: "/subscriptions", icon: BadgeDollarSign, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "客户台账", path: "/customers", icon: Users, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "授权总表", path: "/tv-access", icon: ShieldCheck, roles: ["admin", "super_admin"] },
  { label: "管理员", path: "/sub-admins", icon: UserCog, roles: ["admin", "super_admin"] },
  { label: "代理管理", path: "/agents", icon: ShieldUser, roles: ["admin", "sub_admin", "super_admin"] },
  { label: "系统设置", path: "/settings", icon: Settings, roles: ["admin", "super_admin"] },
  { label: "代理总览", path: "/agent/dashboard", icon: Gauge, roles: ["agent"] },
  { label: "申请记录", path: "/agent/requests", icon: ClipboardCheck, roles: ["agent"] },
  { label: "我的客户", path: "/agent/customers", icon: Building2, roles: ["agent"] },
  { label: "注册 TV", path: "/agent/tv-register", icon: Globe, roles: ["agent"] },
  { label: "可售脚本", path: "/agent/scripts", icon: HardDrive, roles: ["agent"] },
];

export function navigationForRole(role?: Role | null) {
  return navItems.filter((item) => (role ? item.roles.includes(role) : false));
}

const routeLabels: Array<{ test: RegExp; label: string }> = [
  { test: /^\/dashboard$/, label: "总览看板" },
  { test: /^\/scripts$/, label: "脚本管理" },
  { test: /^\/scripts\/\d+$/, label: "脚本详情" },
  { test: /^\/reviews$/, label: "审核中心" },
  { test: /^\/reviews\/\d+$/, label: "审核详情" },
  { test: /^\/subscriptions$/, label: "订阅管理" },
  { test: /^\/subscriptions\/\d+$/, label: "订阅详情" },
  { test: /^\/customers$/, label: "客户台账" },
  { test: /^\/customers\/\d+$/, label: "客户详情" },
  { test: /^\/tv-access$/, label: "授权总表" },
  { test: /^\/sub-admins$/, label: "管理员" },
  { test: /^\/agents$/, label: "代理管理" },
  { test: /^\/agents\/\d+$/, label: "代理详情" },
  { test: /^\/settings$/, label: "系统设置" },
  { test: /^\/profile$/, label: "个人中心" },
  { test: /^\/agent\/dashboard$/, label: "代理总览" },
  { test: /^\/agent\/requests$/, label: "申请记录" },
  { test: /^\/agent\/requests\/new$/, label: "提交申请" },
  { test: /^\/agent\/requests\/\d+$/, label: "申请详情" },
  { test: /^\/agent\/customers$/, label: "我的客户" },
  { test: /^\/agent\/customers\/\d+$/, label: "客户详情" },
  { test: /^\/agent\/tv-register$/, label: "注册 TradingView" },
  { test: /^\/agent\/scripts$/, label: "可售脚本" },
  { test: /^\/design-guide$/, label: "设计规范" },
];

export function pageTitleFor(pathname: string) {
  return routeLabels.find((item) => item.test.test(pathname))?.label ?? "TradingView 权限控制台";
}

export function homePathForRole(role?: Role | null) {
  if (role === "agent") {
    return "/agent/dashboard";
  }
  return "/dashboard";
}
