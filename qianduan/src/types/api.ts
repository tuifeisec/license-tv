export type Role = "super_admin" | "admin" | "sub_admin" | "agent";
export type AuthScope = "admin" | "agent";
export type RequestAction = "new" | "renew" | "modify";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type SubscriptionStatus = "active" | "expired" | "revoked";
export type PlanType = "monthly" | "quarterly" | "yearly" | "lifetime" | "trial";

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserProfile {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  commission_rate: number;
  status: number;
}

export interface CurrentProfile extends UserProfile {
  created_at?: string;
  updated_at?: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

export interface ChangePasswordResult {
  updated: boolean;
  session?: TokenPair;
  other_sessions_invalidated?: boolean;
}

export interface Script {
  id: number;
  pine_id: string;
  name: string;
  description: string;
  kind: string;
  version: string;
  monthly_price: number;
  quarterly_price: number;
  yearly_price: number;
  lifetime_price: number;
  trial_days: number;
  status: number;
  synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScriptAuthorizedUser {
  id: number;
  username: string;
  expiration?: string | null;
  created?: string | null;
}

export interface Customer {
  id: number;
  tv_username: string;
  tv_user_id?: number | null;
  contact: string;
  remark: string;
  agent_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionBrief {
  subscription_id: number;
  script_name: string;
  plan_type: PlanType;
  expires_at: string | null;
}

export interface CustomerListItem extends Customer {
  active_subscriptions: SubscriptionBrief[];
  pending_request_count: number;
}

export interface AccessRequest {
  id: number;
  request_no: string;
  agent_id: number;
  customer_id: number;
  script_id: number;
  action: RequestAction;
  plan_type: PlanType;
  requested_days: number;
  amount: number;
  payment_proof: string;
  status: RequestStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  reject_reason: string;
  remark: string;
  created_at?: string;
  updated_at?: string;
  customer?: Customer;
  script?: Script;
  agent?: UserProfile;
}

export interface Subscription {
  id: number;
  customer_id: number;
  script_id: number;
  plan_type: PlanType;
  status: SubscriptionStatus;
  tv_granted: boolean;
  started_at: string;
  expires_at?: string | null;
  last_request_id?: number | null;
  granted_by?: number | null;
  revoked_at?: string | null;
  revoked_by?: number | null;
  created_at?: string;
  updated_at?: string;
  customer?: Customer;
  script?: Script;
}

export interface CustomerDetail {
  customer: Customer;
  subscriptions: Subscription[];
}

export interface TVUserHint {
  id: number;
  username: string;
  inactive?: boolean;
}

export interface OperationLog {
  id: number;
  operator_id: number;
  action: string;
  target_type: string;
  target_id?: number | null;
  detail?: unknown;
  ip?: string;
  created_at: string;
}

export interface TVSessionInfo {
  configured: boolean;
  sessionid_masked?: string;
  sessionid_sign_masked?: string;
}

export interface TVSessionStatus {
  status: TVSessionInfo;
  valid: boolean;
  error?: string;
  account?: {
    username: string;
  };
}

export interface TVAccessOverviewRow {
  script_id: number;
  script_name: string;
  tv_user_id: number;
  username: string;
  tv_expiration?: string | null;
  tv_created?: string | null;
  access_status: "active" | "expiring" | "expired" | "permanent";
  customer_id?: number | null;
  customer_contact?: string;
  agent_id?: number | null;
  subscription_id?: number | null;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  subscription_tv_granted?: boolean | null;
  reconcile_status:
    | "matched_active"
    | "no_customer"
    | "no_subscription"
    | "db_inactive"
    | "grant_flag_mismatch";
}

export interface TVAccessOverviewError {
  script_id: number;
  script_name: string;
  error: string;
}

export interface TVAccessOverviewSummary {
  total_records: number;
  unique_user_count: number;
  script_count: number;
  active_count: number;
  expiring_count: number;
  expired_count: number;
  permanent_count: number;
  matched_active_count: number;
  no_customer_count: number;
  no_subscription_count: number;
  db_inactive_count: number;
  grant_flag_mismatch_count: number;
  error_script_count: number;
}

export interface TVAccessOverviewResult {
  list: TVAccessOverviewRow[];
  total: number;
  page: number;
  page_size: number;
  summary: TVAccessOverviewSummary;
  error_scripts: TVAccessOverviewError[];
}

export interface TVAccessSyncScriptResult {
  script_id: number;
  script_name: string;
  remote_count: number;
  local_active_count: number;
  inserted_count: number;
  reactivated_count: number;
  updated_count: number;
  unchanged_count: number;
  removed_count: number;
  error?: string;
}

export interface TVAccessSyncResult {
  ran_at: string;
  script_count: number;
  inserted_count: number;
  reactivated_count: number;
  updated_count: number;
  unchanged_count: number;
  removed_count: number;
  error_count: number;
  scripts: TVAccessSyncScriptResult[];
}

export interface AccessAuditEntry {
  script_id: number;
  script_name: string;
  tv_user_count: number;
  db_active_count: number;
  missing_on_tv: string[];
  extra_on_tv: string[];
  error?: string;
}

export interface AccessAuditResult {
  ran_at: string;
  script_count: number;
  mismatch_count: number;
  error_count: number;
  entries: AccessAuditEntry[];
}

export interface AdminDashboardStats {
  admin_count: number;
  agent_count: number;
  script_count: number;
  customer_count: number;
  pending_request_count: number;
  active_subscription_count: number;
  approved_amount_total: number;
  approved_amount_month: number;
}

export interface AgentDashboardStats {
  customer_count: number;
  pending_request_count: number;
  active_subscription_count: number;
  approved_amount_total: number;
  approved_amount_month: number;
}

export interface AgentDetail {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  commission_rate: number;
  status: number;
  created_at?: string;
  updated_at?: string;
  customer_count?: number;
  active_subscription_count?: number;
  approved_amount_total?: number;
}

export interface SubAdminSummary {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  commission_rate: number;
  status: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubAdminDetail {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  status: number;
  created_at?: string;
  updated_at?: string;
  scripts: Script[];
}
