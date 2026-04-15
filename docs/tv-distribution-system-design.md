# TradingView 分销系统当前架构文档

本文档以当前代码实现为准，覆盖后端、前端、角色权限、认证方式、脚本作用域、定时任务、TradingView 对账链路等真实运行结构。

适用范围：

- 后续功能开发前的架构对齐
- 新成员或新 Agent 的项目接入
- 文档与代码一致性校验

## 1. 系统定位

这是一个围绕 TradingView 私有脚本授权展开的分销管理系统，目标不是内容展示，而是完成以下业务闭环：

1. 代理提交授权或续费申请
2. 管理端审核或直接授权
3. 系统调用 TradingView 接口下发 / 修改 / 回收脚本权限
4. 本地维护客户、申请、订阅、授权快照和操作日志
5. 通过定时任务完成同步、审计、过期回收和文件清理

当前系统是一个前后端分离的单体架构：

- 后端：Go + Gin + GORM
- 前端：React 19 + Vite + TypeScript
- 数据库：MySQL
- 外部依赖：TradingView Web 接口

## 2. 当前运行架构

### 2.1 总体结构

```text
Browser
  ├─ 管理控制台 /dashboard, /scripts, /reviews, /subscriptions ...
  └─ 代理控制台 /agent/dashboard, /agent/requests, /agent/customers ...
        │
        ▼
React SPA (qianduan)
  ├─ React Router 路由分组
  ├─ React Query 数据请求
  ├─ Zustand 认证状态
  └─ Axios + Cookie 会话续期
        │
        ▼
Gin API (cmd/server/main.go)
  ├─ middleware: CORS / JWT / Role / ScriptScope / RateLimit
  ├─ handler: admin / agent
  ├─ service: auth / script / customer / review / subscription / tv*
  ├─ scheduler: cron 定时任务
  └─ model: GORM 模型
        │
        ├─ MySQL
        └─ TradingView HTTP 接口
```

### 2.2 启动装配

后端入口位于 `cmd/server/main.go`，启动阶段会完成以下装配：

- 加载 `config/config.yaml`
- 初始化 Zap 日志
- 建立 MySQL 连接并配置连接池
- 自动迁移 GORM 模型
- 初始化 TV Proxy、TV Session、认证、客户、脚本、审核、订阅、快照同步、对账、付款凭证清理等服务
- 初始化调度器并注册 cron 任务
- 装配 Gin 路由

这意味着当前系统是显式装配的应用单体，依赖关系集中在启动阶段可见。

## 3. 技术栈与真实状态

### 3.1 后端

| 组件 | 当前实现 | 说明 |
|------|----------|------|
| Web 框架 | Gin | HTTP 路由与中间件 |
| ORM | GORM | 数据访问与模型迁移 |
| 数据库 | MySQL | 当前真实运行数据库 |
| 认证 | JWT + HttpOnly Cookie | 同时支持 Bearer Header 与 Cookie |
| 日志 | Zap | 结构化日志 |
| 配置 | Viper | YAML + 环境变量 |
| 定时任务 | robfig/cron/v3 | 同步、审计、回收、清理 |

### 3.2 前端

| 组件 | 当前实现 | 说明 |
|------|----------|------|
| 框架 | React 19 | 单页后台 |
| 构建 | Vite | 本地开发与构建 |
| 路由 | React Router | 角色路由分组 |
| 数据层 | React Query | 远程数据缓存与刷新 |
| 状态管理 | Zustand | 登录态与 UI 状态 |
| 表单 | React Hook Form + Zod | 表单校验 |
| 样式 | Tailwind v4 + 自定义组件 | 后台控制台风格 |

### 3.3 Redis 的当前状态

`config/config.yaml` 中已经保留了 Redis 配置，但当前主链路尚未真正接入 Redis。现在的真实状态是：

- 限流仍为单机内存实现
- 会话与鉴权不依赖 Redis
- 多实例共享限流与黑名单机制尚未启用

因此，Redis 目前属于“预留基础设施”，不是已落地核心依赖。

## 4. 角色与权限体系

当前系统已落地四角色模型：

| 角色 | 标识 | 说明 |
|------|------|------|
| 超级管理员 | `super_admin` | 全局最高权限 |
| 管理员 | `admin` | 业务管理与系统管理 |
| 子管理员 | `sub_admin` | 受脚本作用域约束的管理员 |
| 代理 | `agent` | 发起申请、管理客户、查看自己的业务数据 |

### 4.1 角色边界

- `super_admin`：拥有全部后台能力
- `admin`：拥有绝大多数后台能力，包括脚本、审核、订阅、客户、子管理员管理、TV 对账
- `sub_admin`：可访问后台主业务模块，但只能操作被分配脚本相关的数据
- `agent`：走独立的代理端路由，不进入后台管理端

### 4.2 当前权限实现

后端路由分组位于 `internal/router/router.go`：

- `/api/admin/v1`
  - `protected`: `admin / sub_admin / super_admin`
  - `adminOnly`: `admin / super_admin`
  - `subAdminMgmt`: `admin / super_admin`
- `/api/agent/v1`
  - `protected`: `agent`

### 4.3 需要特别说明的当前真实规则

1. `sub_admin` 已可登录后台管理端
2. `sub_admin` 的脚本、审批、订阅、客户、Dashboard 数据会被脚本作用域过滤
3. `sub_admin` 当前可以管理 `agent`
   - 这是当前真实实现
   - 原因是 agent 管理被视为独立用户管理，不绑定脚本作用域
4. `sub_admin` 不可访问系统管理相关接口
   - 例如 TV Cookie、TV 全量快照同步、TV 总表对账、操作日志
5. `agent` 不绑定脚本权限
   - agent 能看到所有上架脚本
   - agent 可以对任意脚本提交申请

## 5. 脚本作用域架构

### 5.1 设计目标

`sub_admin` 是“受脚本权限约束的管理员”。它的限制不是简单菜单隐藏，而是数据边界控制。

当前实现采用两层方案：

1. 路由允许 `sub_admin` 进入后台业务模块
2. 中间件与 Service 层联动，对具体数据做脚本范围过滤

### 5.2 数据基础

相关表与字段：

- `user_script_permissions`
  - 记录子管理员和脚本的多对多关系
- `customers.created_by`
  - 记录客户创建者
  - 用于解决“客户尚未形成订阅关系时，仍需对子管理员可见”的问题

### 5.3 中间件注入

`internal/middleware/script_scope.go`

当前逻辑：

- 如果当前用户不是 `sub_admin`，不注入作用域，视为不受限
- 如果当前用户是 `sub_admin`，查询其 `user_script_permissions`
- 将允许的 `script_id` 列表放入 Gin Context

### 5.4 Service 层落地

`internal/service/scope.go` 提供统一的 `ScriptScope`：

- `Unrestricted()`
- `RestrictedTo(userID, ids)`
- `ApplyToQuery()`
- `Allows()`

当前已接入脚本作用域过滤的模块包括：

- `ScriptService`
- `ReviewService`
- `SubscriptionService`
- `CustomerService`
- `Dashboard`

### 5.5 空权限语义

如果 `sub_admin` 没有分配任何脚本：

- 不报错
- 相关业务查询直接返回空结果
- `ApplyToQuery()` 会转成 `WHERE 1 = 0`

这是一种明确且稳定的“空权限”语义。

## 6. 认证与会话架构

### 6.1 当前真实认证方式

虽然系统底层仍签发 JWT，但前端主链路已经是 Cookie 会话模式，不再依赖把 access token 持久化到浏览器本地存储。

当前真实行为如下：

1. 登录成功后，后端返回 `TokenPair`
2. 同时把 `access_token` 和 `refresh_token` 写入 HttpOnly Cookie
3. Cookie 按作用域分路径：
   - 管理端：`/api/admin/v1`
   - 代理端：`/api/agent/v1`
4. 前端 Zustand 只持久化：
   - `user`
   - `authScope`
5. 前端请求默认走 `withCredentials: true`
6. 后端 JWT 中间件优先接受：
   - `Authorization: Bearer ...`
   - 或 Cookie 中的 `tvd_access_token`

### 6.2 Refresh 机制

刷新逻辑分 admin / agent 两个 scope：

- `POST /api/admin/v1/auth/refresh`
- `POST /api/agent/v1/auth/refresh`

刷新时：

- 支持 body 传 `refresh_token`
- 如果 body 不传，则后端会从 Cookie 读取 `tvd_refresh_token`
- 刷新成功后重新写入 Cookie

### 6.3 认证的当前特点

- JWT 仍是令牌载体
- Cookie 是前端的主要传输方式
- Header 模式仍保留兼容性
- 前端不再需要长期持有 access token

## 7. 后端分层架构

### 7.1 分层结构

```text
internal/
  ├─ config/       配置加载
  ├─ model/        GORM 模型
  ├─ handler/      HTTP 入参与响应
  ├─ middleware/   鉴权、角色、作用域、限流、恢复
  ├─ service/      核心业务逻辑
  ├─ router/       路由装配
  ├─ scheduler/    定时任务
  └─ pkg/          错误码、统一响应、cookie 工具
```

### 7.2 主要 Service 领域

| Service | 职责 |
|---------|------|
| `AuthService` | 登录、刷新、改密、个人资料、agent 管理、sub_admin 管理 |
| `ScriptService` | 脚本同步、脚本列表、脚本更新 |
| `CustomerService` | 客户创建、客户查询、TV 用户校验、客户可见性 |
| `ReviewService` | 代理申请提交、审核通过、拒绝、批量通过 |
| `SubscriptionService` | 直接授权、续费、回收、过期处理 |
| `TVSessionService` | TV Cookie 状态与会话校验 |
| `SystemSettingService` | 系统设置持久化，含 TV Cookie 加密存储 |
| `TVAccessSyncService` | 从 TV 拉取授权用户快照并写入 `tv_accesses` |
| `TVAccessOverviewService` | 生成 TV 授权总表，联查本地客户与订阅状态 |
| `AccessAuditService` | 基于本地 TV 快照与数据库活跃订阅做审计 |
| `PaymentProofService` | 付款凭证文件清理 |

### 7.3 当前架构特点

- 业务逻辑主要集中在 Service 层
- Handler 相对薄，只负责参数绑定与响应
- 外部 TradingView 集成集中在 TV 相关 Service
- 目前仍是应用服务 + 数据访问混合写法，尚未引入更细的 repository 分层

## 8. 前端架构

前端位于 `qianduan/`，当前结构如下：

```text
qianduan/src/
  ├─ api/         Axios 请求封装
  ├─ components/  通用组件与后台布局
  ├─ pages/       admin / agent 页面
  ├─ store/       Zustand 状态
  ├─ types/       API 类型定义
  ├─ lib/         导航、query client、工具函数
  ├─ router.tsx   路由总表
  └─ main.tsx     前端入口
```

当前前端采用一套 SPA 承载两类控制台：

- 管理控制台
- 代理控制台

关键机制：

- `AuthGuard`：登录保护
- `RoleGuard`：角色保护
- 懒加载页面：控制首屏体积
- `adminHttp / agentHttp`：按 scope 隔离的 HTTP 客户端

## 9. 数据模型与关键表

当前已接入 `AutoMigrate` 的模型如下：

- `system_users`
- `system_settings`
- `scripts`
- `user_script_permissions`
- `tv_accesses`
- `customers`
- `access_requests`
- `subscriptions`
- `operation_logs`

### 9.1 核心业务表

#### `system_users`

系统账号表，包含：

- `super_admin`
- `admin`
- `sub_admin`
- `agent`

#### `scripts`

脚本目录表，由系统同步 TradingView 可管理脚本后维护本地元数据：

- `pine_id`
- `name`
- `version`
- `kind`
- 各套餐价格
- `trial_days`
- `status`

#### `customers`

客户表，核心字段包括：

- `tv_username`
- `tv_user_id`
- `contact`
- `remark`
- `agent_id`
- `created_by`

其中：

- `agent_id` 表示客户归属代理
- `created_by` 表示谁在系统里创建了该客户

#### `access_requests`

申请单表，是业务流程单：

- `new / renew / modify`
- `pending / approved / rejected / cancelled`
- 付款凭证路径
- 审核人、审核时间、拒绝原因

#### `subscriptions`

授权结果表，是最终有效授权状态：

- `active / expired / revoked`
- `tv_granted`
- `started_at`
- `expires_at`
- `granted_by`
- `revoked_by`

#### `tv_accesses`

这是当前 TV 对账链路中非常重要的一张表。

它不是业务主表，而是“TradingView 远端授权快照表”，字段包括：

- `script_id`
- `pine_id`
- `tv_user_id`
- `username`
- `expiration`
- `tv_created_at`
- `synced_at`
- `removed_at`

它用于承接：

- 从 TV 远端同步的授权用户列表
- 本地总表对账
- 审计分析

### 9.2 配置与审计表

#### `system_settings`

当前用于持久化系统设置，最重要的是：

- `tradingview.cookies`

TV Cookie 会经过 AES-GCM 加密后再持久化到数据库。

#### `operation_logs`

记录关键操作行为，例如：

- 审核通过
- 审核拒绝
- 直接授权
- 续费
- 回收
- TV 授权快照同步
- 审计运行

## 10. TradingView 集成与对账架构

### 10.1 TV 接口接入

`internal/service/tv_proxy.go` 负责封装对 TradingView 的主要调用，包括：

- Session 校验
- 用户名搜索
- 脚本列表同步
- 已授权用户列表
- 授权下发
- 授权移除
- 到期时间修改

### 10.2 TV Cookie 管理

当前 TV Cookie 管理链路如下：

1. 管理员通过 `/system/tv-cookies` 更新 `sessionid` 与 `sessionid_sign`
2. `TVSessionService` 调用 `SystemSettingService` 持久化
3. `SystemSettingService` 对 Cookie 值做加密后写入 `system_settings`
4. 服务启动时会尝试自动加载数据库中已保存的 Cookie
5. `/system/tv-session` 可查看当前状态与校验结果

### 10.3 TV 授权快照同步

接口：

- `POST /api/admin/v1/system/sync-tv-access`

服务：

- `TVAccessSyncService`

当前逻辑：

1. 遍历可用脚本
2. 从 TV 拉取脚本的完整授权用户列表
3. 写入或更新 `tv_accesses`
4. 对不存在于远端的本地快照打 `removed_at`

这一步的结果是得到一份“本地 TV 授权快照”。

### 10.4 TV 授权总表

接口：

- `GET /api/admin/v1/system/tv-access-overview`

服务：

- `TVAccessOverviewService`

当前总表不是直接实时拉取 TradingView，而是基于本地 `tv_accesses` 快照，再联查：

- `customers`
- `subscriptions`
- `scripts`

输出每一条 TV 授权在本地业务中的归属状态，例如：

- `matched_active`
- `no_customer`
- `no_subscription`
- `db_inactive`
- `grant_flag_mismatch`

### 10.5 授权审计

接口：

- `POST /api/admin/v1/system/sync-access`

服务：

- `AccessAuditService`

当前审计逻辑是：

1. 基于 `tv_accesses` 中未移除的快照作为 TV 侧数据源
2. 基于 `subscriptions.status = active` 作为数据库侧有效授权
3. 逐脚本比较：
   - `MissingOnTV`
   - `ExtraOnTV`

也就是说，当前“对账”和“审计”已经拆成两层：

- `sync-tv-access`：先同步远端快照
- `sync-access`：再用快照与业务表做审计

## 11. 核心业务链路

### 11.1 代理申请链路

```text
agent 提交申请
  -> 创建 / 关联客户
  -> 写入 access_requests (pending)
  -> 管理端审核
  -> 调用 TV 授权接口
  -> 写入或更新 subscriptions
  -> 更新 access_requests 为 approved / rejected
```

### 11.2 管理端直接授权链路

```text
admin / sub_admin 直接发起授权
  -> 校验脚本作用域
  -> 创建 / 获取客户
  -> 最终校验 TV 用户
  -> 调用 TV Add / Modify
  -> 创建 subscriptions
  -> 写操作日志
```

### 11.3 续费与回收

- 续费：修改 TV 到期时间并更新本地订阅
- 回收：调用 TV 移除授权并把本地订阅标记为 `revoked`

## 12. 定时任务架构

当前调度器位于 `internal/scheduler/scheduler.go`，已经落地的任务如下：

| 任务 | Cron | 当前作用 |
|------|------|----------|
| Cookie 健康检查 | `*/30 * * * *` | 检查 TV Session 是否失效 |
| 过期订阅回收 | `*/10 * * * *` | 回收过期订阅的 TV 授权 |
| 脚本同步 | `0 3 * * *` | 同步脚本目录 |
| TV 授权快照同步 | `0 3 * * *` | 同步 `tv_accesses` |
| 授权审计 | `0 4 * * *` | 基于快照做 DB / TV 差异审计 |
| 付款凭证清理 | `30 4 * * *` | 清理无主付款凭证文件 |

说明：

- 脚本同步和 TV 快照同步都在凌晨 3 点执行
- 审计在凌晨 4 点执行，保证优先使用较新的快照

## 13. 配置结构

当前配置文件为 `config/config.yaml`，核心段如下：

- `server`
  - `port`
  - `mode`
  - `allowed_origins`
  - `log_level`
- `database`
  - MySQL 主机、端口、账号、连接池
- `redis`
  - 预留，当前未接入主链路
- `security`
  - 数据加密密钥
- `jwt`
  - token 生命周期
  - cookie domain / secure / same_site
- `tradingview`
  - TV 域名、Cookie、超时、重试次数
- `scheduler`
  - cron 表达式
- `admin`
  - 启动时自动初始化 super admin

## 14. 当前实现与旧设计的关键差异

以下是当前代码和早期设计相比，必须以代码为准的差异：

1. 数据库不是 PostgreSQL，而是 MySQL
2. 系统已不是三角色，而是四角色：`super_admin / admin / sub_admin / agent`
3. `sub_admin` 已经落地，并有脚本作用域控制
4. 前端主链路认证已是 Cookie 模式，不再依赖把 token 长期存入本地
5. TV Cookie 不是明文存放在配置里，而是会持久化到数据库并加密存储
6. TV 对账不是“每次直接远程查”，而是：
   - 先同步 `tv_accesses` 快照
   - 再基于快照做总表与审计
7. Redis 配置已存在，但还没有成为主链路依赖

## 15. 当前架构结论

当前项目可以定义为：

> 一个以 TradingView 授权为核心、以角色和脚本作用域为边界、以申请审核与订阅状态为主链路、并带有本地 TV 快照和审计能力的前后端分离单体系统。

这也是后续继续开发时应遵循的架构基线。
