# TradingView 分销系统 API 文档

本文档以当前仓库代码实现为准，覆盖真实路由、鉴权方式、角色权限、请求参数和主要返回结构。

## 1. 基础信息

### 1.1 基础路径

- 管理端：`/api/admin/v1`
- 代理端：`/api/agent/v1`
- 健康检查：`/health`
- 静态文件：`/uploads/*`

### 1.2 当前鉴权方式

当前系统使用 `JWT + HttpOnly Cookie` 组合模式。

后端 JWT 中间件支持两种携带方式：

1. `Authorization: Bearer <access_token>`
2. Cookie 中的 `tvd_access_token`

前端主链路当前默认使用 Cookie：

- 登录成功后后端会写入 `tvd_access_token`
- 同时写入 `tvd_refresh_token`
- 管理端 Cookie Path：`/api/admin/v1`
- 代理端 Cookie Path：`/api/agent/v1`

刷新接口既支持：

- body 里传 `refresh_token`
- 也支持直接从 Cookie 读取刷新令牌

### 1.3 数据格式

- 请求：`application/json`
- 上传付款凭证：`multipart/form-data`
- 时间：后端统一使用 UTC 存储与返回

## 2. 统一响应格式

### 2.1 成功

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 2.2 分页

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

### 2.3 失败

```json
{
  "code": 10001,
  "message": "invalid request parameters",
  "data": null
}
```

## 3. 常用错误码

| code | message | 说明 |
|---|---|---|
| `10001` | `invalid request parameters` | 参数校验失败 |
| `10002` | `unauthorized` | 未登录或缺少认证 |
| `10003` | `permission denied` | 权限不足 |
| `10004` | `account disabled` | 账号被禁用 |
| `10005` | `invalid username or password` | 用户名或密码错误 |
| `10006` | `token expired or invalid` | 会话失效 |
| `10007` | `payment proof file is invalid` | 付款凭证文件类型或路径无效 |
| `10008` | `payment proof file is too large` | 付款凭证过大 |
| `10100` | `TradingView cookie invalid` | TV Cookie 无效 |
| `10101` | `TV username not found` | TV 用户不存在 |
| `10102` | `TV script not found` | 脚本不存在 |
| `10103` | `TradingView authorization failed` | TV 授权调用失败 |
| `10200` | `access request not found` | 授权申请不存在 |
| `10201` | `request status does not allow this action` | 当前申请状态不允许此操作 |
| `10202` | `duplicate pending request exists` | 已存在重复待审核申请 |
| `10300` | `active subscription already exists` | 已存在活跃订阅 |
| `10301` | `subscription not found` | 订阅不存在 |
| `10400` | `customer not found` | 客户不存在 |
| `10401` | `TV username already exists` | TV 用户名已存在于本地客户表 |
| `10500` | `agent not found` | 代理不存在 |
| `10600` | `sub admin not found` | 子管理员不存在 |
| `10601` | `sub admin username already exists` | 子管理员用户名重复 |
| `10602` | `no permission for this script` | 当前账号无权操作该脚本 |
| `10999` | `internal server error` | 服务内部错误 |

## 4. 关键枚举

### 4.1 角色

- `super_admin`
- `admin`
- `sub_admin`
- `agent`

### 4.2 授权申请动作

- `new`
- `renew`
- `modify`

### 4.3 申请状态

- `pending`
- `approved`
- `rejected`
- `cancelled`

### 4.4 订阅状态

- `active`
- `expired`
- `revoked`

### 4.5 套餐类型

- `monthly`
- `quarterly`
- `yearly`
- `lifetime`
- `trial`

### 4.6 TV 总表 access_status

- `active`
- `expiring`
- `expired`
- `permanent`

### 4.7 TV 总表 reconcile_status

- `matched_active`
- `no_customer`
- `no_subscription`
- `db_inactive`
- `grant_flag_mismatch`

## 5. 常用数据结构

### 5.1 TokenPair

```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user": {
    "id": 1,
    "username": "admin_user",
    "role": "super_admin",
    "display_name": "超级管理员",
    "commission_rate": 0,
    "status": 1
  }
}
```

### 5.2 Script

```json
{
  "id": 1,
  "pine_id": "PUB;xxxx",
  "name": "My Script",
  "description": "desc",
  "kind": "study",
  "version": "1.0",
  "monthly_price": 199,
  "quarterly_price": 499,
  "yearly_price": 1299,
  "lifetime_price": 3999,
  "trial_days": 7,
  "status": 1,
  "synced_at": "2026-04-11T12:00:00Z",
  "created_at": "2026-04-11T12:00:00Z",
  "updated_at": "2026-04-11T12:00:00Z"
}
```

### 5.3 Customer

```json
{
  "id": 1,
  "tv_username": "TradingViewUser",
  "tv_user_id": 123456,
  "contact": "wechat:demo",
  "remark": "important client",
  "agent_id": 8,
  "created_at": "2026-04-11T12:00:00Z",
  "updated_at": "2026-04-11T12:00:00Z"
}
```

### 5.4 AccessRequest

```json
{
  "id": 1,
  "request_no": "REQ20260411120000ABCDE",
  "agent_id": 8,
  "customer_id": 10,
  "script_id": 3,
  "action": "new",
  "plan_type": "monthly",
  "requested_days": 0,
  "amount": 199,
  "payment_proof": "/uploads/payment-proofs/1712820000-aabbccdd.png",
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "reject_reason": "",
  "remark": "first order",
  "customer": {},
  "script": {},
  "agent": {}
}
```

### 5.5 Subscription

```json
{
  "id": 1,
  "customer_id": 10,
  "script_id": 3,
  "plan_type": "monthly",
  "status": "active",
  "tv_granted": true,
  "started_at": "2026-04-11T12:00:00Z",
  "expires_at": "2026-05-11T12:00:00Z",
  "last_request_id": 15,
  "granted_by": 1,
  "revoked_at": null,
  "revoked_by": null,
  "customer": {},
  "script": {}
}
```

### 5.6 AdminDashboardStats

```json
{
  "active_subscription_count": 0,
  "admin_count": 1,
  "agent_count": 1,
  "approved_amount_month": 0,
  "approved_amount_total": 0,
  "customer_count": 0,
  "pending_request_count": 0,
  "script_count": 1
}
```

## 6. 公共接口

### 6.1 `GET /health`

说明：健康检查接口。

返回示例：

```json
{
  "status": "ok",
  "time": "2026-04-13T12:00:00Z",
  "checks": {
    "database": "ok",
    "tv_configured": true
  }
}
```

降级时返回 `503`，并给出 `database=unavailable`。

## 7. 管理端 API

## 7.1 认证与个人资料

### `POST /api/admin/v1/auth/login`

说明：管理端登录，允许角色：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "username": "admin_user",
  "password": "<secure-admin-password>"
}
```

返回：`TokenPair`

补充说明：

- 后端会同时写入 `tvd_access_token` 和 `tvd_refresh_token` Cookie
- 返回体中仍保留 `access_token` / `refresh_token` 字段，便于兼容

### `POST /api/admin/v1/auth/refresh`

说明：刷新管理端会话。

请求体可选：

```json
{
  "refresh_token": "your-refresh-token"
}
```

如果 body 不传，后端会从 Cookie 读取 `tvd_refresh_token`。

返回：`TokenPair`

### `POST /api/admin/v1/auth/logout`

说明：退出登录并清理管理端 Cookie。

返回：

```json
{
  "logged_out": true
}
```

### `GET /api/admin/v1/auth/profile`

说明：获取当前登录账号信息。

返回：`CurrentProfile`

### `PUT /api/admin/v1/auth/profile`

说明：更新当前登录账号显示名。

请求体：

```json
{
  "display_name": "新的显示名"
}
```

返回：更新后的 `CurrentProfile`

### `PUT /api/admin/v1/auth/password`

说明：修改当前登录账号密码。

请求体：

```json
{
  "old_password": "old-pass",
  "new_password": "new-pass-123"
}
```

返回：

```json
{
  "updated": true,
  "session": {
    "access_token": "string",
    "refresh_token": "string",
    "user": {}
  },
  "other_sessions_invalidated": true
}
```

## 7.2 Dashboard

### `GET /api/admin/v1/dashboard/stats`

权限：

- `admin`
- `sub_admin`
- `super_admin`

说明：

- `admin / super_admin` 返回全局统计
- `sub_admin` 返回脚本作用域内统计

返回示例：

```json
{
  "active_subscription_count": 128,
  "admin_count": 2,
  "agent_count": 16,
  "approved_amount_month": 12999,
  "approved_amount_total": 88888,
  "customer_count": 300,
  "pending_request_count": 6,
  "script_count": 12
}
```

## 7.3 脚本管理

### `GET /api/admin/v1/scripts`

权限：

- `admin`
- `sub_admin`
- `super_admin`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`
  - `enabled`
  - `disabled`
- `active_only`
  - `1` / `true`

说明：

- `sub_admin` 只能看到自己作用域内脚本
- `active_only` 为真时只返回上架脚本

返回：分页 `Script[]`

### `GET /api/admin/v1/scripts/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

说明：

- `sub_admin` 仅能查看自己有权限的脚本

返回：`Script`

### `PUT /api/admin/v1/scripts/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：字段均可选

```json
{
  "name": "New Script Name",
  "description": "new desc",
  "monthly_price": 199,
  "quarterly_price": 499,
  "yearly_price": 1299,
  "lifetime_price": 3999,
  "trial_days": 7,
  "status": 1
}
```

返回：更新后的 `Script`

### `POST /api/admin/v1/scripts/sync`

权限：

- `admin`
- `super_admin`

说明：从 TradingView 同步可管理脚本。

返回：

```json
{
  "synced": 7
}
```

### `GET /api/admin/v1/scripts/:id/users`

权限：

- `admin`
- `super_admin`

说明：查看某个脚本在 TradingView 上的实际授权用户。

返回：`ScriptAuthorizedUser[]`

## 7.4 审核管理

### `GET /api/admin/v1/reviews`

权限：

- `admin`
- `sub_admin`
- `super_admin`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`
- `script_id`

说明：

- `sub_admin` 只能看到自己脚本作用域内的申请

返回：分页 `AccessRequest[]`

### `GET /api/admin/v1/reviews/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

返回：`AccessRequest`

### `POST /api/admin/v1/reviews/:id/approve`

权限：

- `admin`
- `sub_admin`
- `super_admin`

说明：审核通过并联动 TradingView 授权。

返回：

```json
{
  "approved": true
}
```

### `POST /api/admin/v1/reviews/:id/reject`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "reason": "payment proof is invalid"
}
```

返回：

```json
{
  "rejected": true
}
```

### `POST /api/admin/v1/reviews/batch-approve`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "request_ids": [1, 2, 3]
}
```

返回：

```json
{
  "success_ids": [1, 2],
  "failed": {
    "3": "request status does not allow this action"
  }
}
```

## 7.5 订阅管理

### `GET /api/admin/v1/subscriptions`

权限：

- `admin`
- `sub_admin`
- `super_admin`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`
- `script_id`
- `agent_id`
- `customer_keyword`

说明：

- `sub_admin` 仅能看到作用域内脚本的订阅

返回：分页 `Subscription[]`

### `POST /api/admin/v1/subscriptions`

权限：

- `admin`
- `sub_admin`
- `super_admin`

说明：直接授权，跳过审核。

请求体：

```json
{
  "customer_id": 10,
  "tv_username": "TradingViewUser",
  "contact": "wechat:demo",
  "remark": "vip",
  "agent_id": 8,
  "script_id": 3,
  "plan_type": "monthly",
  "requested_days": 0
}
```

说明：

- `customer_id` 和 `tv_username` 二选一即可
- 若使用 `tv_username` 且客户不存在，会自动创建客户
- `sub_admin` 只能对自己有权限的脚本直接授权

返回：`Subscription`

### `POST /api/admin/v1/subscriptions/:id/renew`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "plan_type": "quarterly",
  "requested_days": 0
}
```

返回：更新后的 `Subscription`

### `POST /api/admin/v1/subscriptions/:id/revoke`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "reason": "manual revoke"
}
```

返回：

```json
{
  "revoked": true
}
```

### `GET /api/admin/v1/subscriptions/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

返回：`Subscription`

## 7.6 客户管理

### `GET /api/admin/v1/customers`

权限：

- `admin`
- `sub_admin`
- `super_admin`

查询参数：

- `page`
- `page_size`
- `keyword`

说明：

- `sub_admin` 的客户可见范围为：
  - 有自己作用域脚本订阅关系的客户
  - 或自己创建的客户

返回：分页 `Customer[]`

### `POST /api/admin/v1/customers`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "tv_username": "TradingViewUser",
  "contact": "wechat:demo",
  "remark": "vip client",
  "agent_id": 8
}
```

返回：`Customer`

### `GET /api/admin/v1/customers/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

返回：

```json
{
  "customer": {},
  "subscriptions": []
}
```

### `PUT /api/admin/v1/customers/:id`

权限：

- `admin`
- `sub_admin`
- `super_admin`

请求体：

```json
{
  "contact": "telegram:@demo",
  "remark": "updated note"
}
```

返回：更新后的 `Customer`

### `GET /api/admin/v1/tv/validate-username`

权限：

- `admin`
- `sub_admin`
- `super_admin`

查询参数：

- `keyword`
- 或兼容 `s`

返回：`TVUserHint[]`

## 7.7 代理管理

权限：

- `admin`
- `sub_admin`
- `super_admin`

说明：

- 当前真实实现中，`sub_admin` 也可以创建和管理 `agent`
- 代理管理不受脚本作用域限制

### `GET /api/admin/v1/agents`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`
- `performance`
- `sort_by`
  - `created_at`
  - `customer_count`
  - `active_subscription_count`
  - `approved_amount_total`
- `sort_order`
  - `asc`
  - `desc`

返回：分页 `AgentDetail[]`

### `POST /api/admin/v1/agents`

请求体：

```json
{
  "username": "agent_demo",
  "password": "<secure-agent-password>",
  "display_name": "华东代理",
  "commission_rate": 0.15,
  "status": 1
}
```

返回：创建后的 `AgentDetail`

### `PUT /api/admin/v1/agents/:id`

请求体：字段均可选

```json
{
  "display_name": "华南代理",
  "commission_rate": 0.18,
  "status": 1
}
```

返回：更新后的 `AgentDetail`

### `POST /api/admin/v1/agents/:id/reset-password`

请求体：

```json
{
  "new_password": "new-pass-123"
}
```

返回：

```json
{
  "updated": true
}
```

### `GET /api/admin/v1/agents/:id`

返回：`AgentDetail`

## 7.8 子管理员管理

权限：

- `admin`
- `super_admin`

### `GET /api/admin/v1/sub-admins`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`

返回：分页 `SubAdminSummary[]`

### `POST /api/admin/v1/sub-admins`

请求体：

```json
{
  "username": "sub_admin_demo",
  "password": "<secure-sub-admin-password>",
  "display_name": "华东子管理员",
  "status": 1,
  "script_ids": [1, 2, 3]
}
```

返回：`SubAdminDetail`

### `GET /api/admin/v1/sub-admins/:id`

返回：`SubAdminDetail`

### `PUT /api/admin/v1/sub-admins/:id`

请求体：字段均可选

```json
{
  "display_name": "新的显示名",
  "status": 1
}
```

返回：更新后的 `SubAdminDetail`

### `POST /api/admin/v1/sub-admins/:id/reset-password`

请求体：

```json
{
  "new_password": "new-pass-123"
}
```

返回：

```json
{
  "updated": true
}
```

### `PUT /api/admin/v1/sub-admins/:id/scripts`

说明：全量替换脚本权限，允许传空数组。

请求体：

```json
{
  "script_ids": [1, 2, 3]
}
```

清空权限示例：

```json
{
  "script_ids": []
}
```

返回：

```json
{
  "updated": true
}
```

## 7.9 TV 与系统管理

权限：

- `admin`
- `super_admin`

### `GET /api/admin/v1/system/tv-session`

说明：查看当前 TV Cookie 配置状态与校验结果。

返回示例：

```json
{
  "status": {
    "configured": true,
    "sessionid_masked": "abcd****wxyz",
    "sessionid_sign_masked": "1234****7890"
  },
  "valid": true,
  "account": {
    "username": "demo"
  }
}
```

### `PUT /api/admin/v1/system/tv-cookies`

说明：更新并持久化 TV Cookie，服务启动时会自动加载。

请求体：

```json
{
  "sessionid": "your-sessionid",
  "sessionid_sign": "your-sessionid-sign"
}
```

返回：

```json
{
  "updated": true
}
```

### `POST /api/admin/v1/system/sync-tv-access`

说明：同步 TradingView 授权快照到本地 `tv_accesses`。

请求体可选：

```json
{
  "script_id": 1
}
```

不传时表示全量同步全部启用脚本。

返回：`TVAccessSyncResult`

### `GET /api/admin/v1/system/tv-access-overview`

说明：基于本地 `tv_accesses` 快照联查客户与订阅状态，生成统一总表。

查询参数：

- `page`
- `page_size`
- `keyword`
- `script_id`
- `access_status`
- `reconcile_status`

返回：`TVAccessOverviewResult`

### `POST /api/admin/v1/system/sync-access`

说明：基于本地 `tv_accesses` 快照与数据库活跃订阅做差异审计。

返回：`AccessAuditResult`

### `GET /api/admin/v1/system/operation-logs`

查询参数：

- `page`
- `page_size`
- `action`

返回：分页 `OperationLog[]`

## 8. 代理端 API

## 8.1 认证与个人资料

### `POST /api/agent/v1/auth/login`

请求体：

```json
{
  "username": "agent_demo",
  "password": "<secure-agent-password>"
}
```

返回：`TokenPair`

### `POST /api/agent/v1/auth/refresh`

请求体可选：

```json
{
  "refresh_token": "your-refresh-token"
}
```

返回：`TokenPair`

### `POST /api/agent/v1/auth/logout`

返回：

```json
{
  "logged_out": true
}
```

### `GET /api/agent/v1/auth/profile`

返回：`CurrentProfile`

### `PUT /api/agent/v1/auth/profile`

请求体：

```json
{
  "display_name": "新的显示名"
}
```

返回：更新后的 `CurrentProfile`

### `PUT /api/agent/v1/auth/password`

请求体：

```json
{
  "old_password": "old-pass",
  "new_password": "new-pass-123"
}
```

返回：`ChangePasswordResult`

## 8.2 授权申请

### `POST /api/agent/v1/requests`

说明：提交授权申请。

请求体：

```json
{
  "customer_id": 10,
  "tv_username": "TradingViewUser",
  "contact": "wechat:demo",
  "remark": "first order",
  "script_id": 3,
  "action": "new",
  "plan_type": "monthly",
  "requested_days": 0,
  "amount": 199,
  "payment_proof": "/uploads/payment-proofs/1712820000-aabbccdd.png"
}
```

说明：

- `customer_id` 和 `tv_username` 二选一即可
- 若不传 `customer_id`，系统会尝试按 `tv_username` 查找或创建客户
- 当前代理端不做最终 TV 用户标准化，以管理端审核前校验为准

返回：`AccessRequest`

### `POST /api/agent/v1/uploads/payment-proof`

说明：上传付款凭证图片。

请求方式：

- `multipart/form-data`
- 字段名：`file`

限制：

- 最大 5MB
- 仅支持：
  - `image/jpeg`
  - `image/png`
  - `image/webp`

返回示例：

```json
{
  "url": "http://localhost:8080/uploads/payment-proofs/1712820000-aabbccdd.png",
  "path": "/uploads/payment-proofs/1712820000-aabbccdd.png",
  "content_type": "image/png",
  "size": 123456
}
```

### `GET /api/agent/v1/requests`

查询参数：

- `page`
- `page_size`
- `keyword`
- `status`
- `script_id`

返回：分页 `AccessRequest[]`

### `GET /api/agent/v1/requests/:id`

说明：查看自己的申请详情。

返回：`AccessRequest`

### `POST /api/agent/v1/requests/:id/cancel`

说明：取消自己处于 `pending` 状态的申请。

返回：

```json
{
  "cancelled": true
}
```

## 8.3 客户管理

### `GET /api/agent/v1/customers`

说明：仅返回当前代理名下客户。

查询参数：

- `page`
- `page_size`
- `keyword`

返回：分页 `Customer[]`

### `POST /api/agent/v1/customers`

请求体：

```json
{
  "tv_username": "TradingViewUser",
  "contact": "wechat:demo",
  "remark": "vip client"
}
```

返回：`Customer`

### `GET /api/agent/v1/customers/:id`

说明：仅可查看自己名下客户。

返回：

```json
{
  "customer": {},
  "subscriptions": []
}
```

### `PUT /api/agent/v1/customers/:id`

请求体：

```json
{
  "contact": "telegram:@demo",
  "remark": "updated note"
}
```

返回：更新后的 `Customer`

## 8.4 代理端其他接口

### `GET /api/agent/v1/scripts`

说明：获取可售脚本列表，仅返回上架脚本。

查询参数：

- `page`
- `page_size`
- `keyword`

返回：分页 `Script[]`

### `GET /api/agent/v1/tv/validate-username`

查询参数：

- `keyword`
- 或兼容 `s`

返回：`TVUserHint[]`

### `GET /api/agent/v1/stats`

说明：获取当前代理个人业绩统计。

返回示例：

```json
{
  "customer_count": 20,
  "pending_request_count": 3,
  "active_subscription_count": 35,
  "approved_amount_total": 18888,
  "approved_amount_month": 3999
}
```

## 9. 当前权限口径

### 9.1 管理端登录角色

- `admin`
- `sub_admin`
- `super_admin`

### 9.2 `admin / sub_admin / super_admin` 共用的后台主业务接口

- `/dashboard/stats`
- `/scripts`
- `/reviews`
- `/subscriptions`
- `/customers`
- `/agents`
- `/auth/profile`
- `/auth/password`

### 9.3 仅 `admin / super_admin`

- `/scripts/sync`
- `/scripts/:id/users`
- `/system/tv-session`
- `/system/tv-cookies`
- `/system/sync-tv-access`
- `/system/sync-access`
- `/system/tv-access-overview`
- `/system/operation-logs`
- `/sub-admins/*`

### 9.4 `sub_admin` 的额外作用域限制

以下资源会按脚本权限过滤：

- 脚本列表与详情
- 审核列表与审批动作
- 订阅列表与订阅操作
- 客户列表与客户详情
- Dashboard 统计

如果 `sub_admin` 没有分配任何脚本：

- 不报错
- 业务查询返回空结果

### 9.5 代理端

- 仅 `agent` 可访问 `/api/agent/v1/*` 受保护接口
- agent 不绑定脚本权限
- agent 能看到所有上架脚本，并可提交任意脚本申请

## 10. 限流说明

- 管理端：每分钟 `120` 次
- 代理端：每分钟 `60` 次

当前限流为单机内存实现，适合单实例部署。多实例部署时建议迁移为 Redis 方案。

## 11. 说明

1. 文档内容以当前仓库代码为准。
2. 当前 TV 总表和审计基于本地 `tv_accesses` 快照，不是每次实时直连远端。
3. TV Cookie 会持久化到数据库，并以加密形式存储。
4. 如果后续 DTO 或路由变更，建议同步更新本文件。
