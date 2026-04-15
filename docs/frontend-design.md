# TradingView 分销系统前端实现文档

本文档以当前 `qianduan/` 目录下的真实实现为准，描述前端技术栈、路由结构、权限方案、页面组成、状态管理与 UI 设计方向。

遵循设计基线：

- `qianduan/design-guide/SKILL.md`
- 当前仓库已经形成的紧凑型后台风格

## 1. 技术栈

| 项 | 当前实现 |
|----|----------|
| 框架 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 + CSS Variables |
| 图标 | Lucide React |
| 路由 | React Router |
| 服务端状态 | TanStack Query |
| 客户端状态 | Zustand |
| HTTP | Axios |
| 表单 | React Hook Form + Zod |

项目目录：`qianduan/`

## 2. 前端定位

当前前端不是两套独立项目，而是一套 React SPA 同时承载：

- 管理控制台
- 代理控制台

登录后按用户角色切到不同首页：

- `admin / sub_admin / super_admin` -> `/dashboard`
- `agent` -> `/agent/dashboard`

## 3. 当前认证实现

### 3.1 登录模式

登录页采用身份切换方案：

- 管理端登录
- 代理端登录

分别调用：

- `POST /api/admin/v1/auth/login`
- `POST /api/agent/v1/auth/login`

### 3.2 当前真实会话方案

当前前端已经不再把 access token / refresh token 持久化到 localStorage。

真实实现如下：

1. 登录成功后，后端在响应中返回 `TokenPair`
2. 后端同时写入 HttpOnly Cookie
3. 前端 `useAuthStore` 只持久化：
   - `user`
   - `authScope`
4. Axios 请求统一启用 `withCredentials: true`
5. 刷新会话时优先走 Cookie 机制

这意味着：

- JavaScript 不再依赖长期保存 token 字符串
- 前端更像“维护当前身份态”，不是“自己管理完整令牌生命周期”

### 3.3 Refresh 策略

`qianduan/src/api/http.ts` 的当前逻辑：

- 管理端和代理端各有自己的 Axios 实例
- 401 或 token 失效时会触发 refresh
- 同一 scope 下有 refresh 锁，避免并发刷新风暴
- refresh 成功后重试原请求
- refresh 失败后清理 session，并由全局通知提示重新登录

## 4. 当前角色与菜单

当前前端支持四角色：

- `super_admin`
- `admin`
- `sub_admin`
- `agent`

导航定义位于 `qianduan/src/lib/navigation.tsx`。

### 4.1 管理端菜单

适用于 `admin / sub_admin / super_admin`：

- 总览看板
- 脚本管理
- 审核中心
- 订阅管理
- 客户台账
- 代理管理

仅 `admin / super_admin`：

- 授权总表
- 子管理员
- 系统设置

### 4.2 代理端菜单

适用于 `agent`：

- 代理总览
- 申请记录
- 我的客户
- 注册 TV
- 可售脚本

## 5. 当前路由结构

路由入口：`qianduan/src/router.tsx`

### 5.1 公共路由

- `/login`
- `/403`
- `/design-guide`
- `/profile`

### 5.2 管理端主业务路由

适用于 `admin / sub_admin / super_admin`：

- `/dashboard`
- `/scripts`
- `/scripts/:id`
- `/reviews`
- `/reviews/:id`
- `/subscriptions`
- `/subscriptions/:id`
- `/customers`
- `/customers/:id`
- `/agents`
- `/agents/:id`

### 5.3 管理端高级路由

适用于 `admin / super_admin`：

- `/tv-access`
- `/sub-admins`
- `/settings`

### 5.4 代理端路由

适用于 `agent`：

- `/agent/dashboard`
- `/agent/requests`
- `/agent/requests/new`
- `/agent/requests/:id`
- `/agent/customers`
- `/agent/customers/:id`
- `/agent/tv-register`
- `/agent/scripts`

### 5.5 守卫机制

当前前端使用两层守卫：

- `AuthGuard`
  - 未登录时跳转 `/login?redirect=...`
- `RoleGuard`
  - 控制角色路由访问

说明：

- `super_admin` 在前端路由守卫中天然兼容 `admin` 角色路由
- 页面懒加载已启用，所有主要页面通过 `React.lazy` + `Suspense` 加载

## 6. 当前页面地图

## 6.1 公共页面

### `LoginPage`

作用：

- 管理端 / 代理端登录入口
- 支持登录后按角色跳转
- 支持通过 `redirect` 参数回跳

### `ProfilePage`

作用：

- 查看当前账号资料
- 修改个人显示名
- 修改密码

### `DesignGuidePage`

作用：

- 内部设计规范展示页
- 用于统一设计语言与组件样式参考

## 6.2 管理端页面

### `DashboardPage`

当前状态：

- 已重构为紧凑型图表总览页
- 信息组织强调图表化，而不是说明文案堆叠

当前主要展示：

- KPI 压缩卡片
- 业务结构图
- 执行仪表
- 团队分布
- 运营压强

数据源：

- `GET /api/admin/v1/dashboard/stats`

### `ScriptListPage`

作用：

- 管理脚本目录
- 搜索、筛选、分页
- 管理员可同步脚本
- `sub_admin` 仅可见自己作用域内脚本

### `ScriptDetailPage`

作用：

- 查看脚本详情
- 修改价格、说明、状态
- 管理员可查看 TV 实际授权用户
- `sub_admin` 当前不可查看授权用户面板，也不会触发相关查询

### `ReviewListPage`

作用：

- 审核申请列表
- 状态筛选、脚本筛选
- 批量审核通过

`sub_admin` 限制：

- 仅能看到作用域脚本申请

### `ReviewDetailPage`

作用：

- 申请详情
- 付款凭证查看
- 审核通过 / 拒绝

### `SubscriptionListPage`

作用：

- 订阅列表
- 直接授权
- 续费
- 回收

### `SubscriptionDetailPage`

作用：

- 查看单条订阅
- 发起续费或回收

### `CustomerListPage`

作用：

- 客户列表
- 搜索
- 创建客户

### `CustomerDetailPage`

作用：

- 客户详情
- 展示关联订阅列表

### `AgentListPage`

当前真实权限：

- `admin`
- `sub_admin`
- `super_admin`

作用：

- 管理代理账号
- 列表、创建、编辑、重置密码

### `AgentDetailPage`

作用：

- 查看代理详情与核心经营数据

### `SubAdminListPage`

当前真实权限：

- `admin`
- `super_admin`

作用：

- 子管理员列表
- 创建
- 编辑
- 重置密码
- 分配脚本权限

### `TVAccessOverviewPage`

作用：

- 查看本地 `tv_accesses` 快照生成的 TV 授权总表
- 做统一对账视图

### `SettingsPage`

作用：

- 查看 TV Cookie 状态
- 更新 TV Cookie
- 手动触发 TV 快照同步
- 手动触发授权审计
- 查看操作日志

## 6.3 代理端页面

### `AgentDashboardPage`

当前状态：

- 已演进为高密度图表后台
- 不是简单 5 个数字卡片

当前包含：

- KPI 卡片
- 客户池结构
- 漏斗与覆盖率
- 收入快照
- 执行监控
- 快捷入口

### `AgentRequestListPage`

作用：

- 查看自己的申请列表
- 筛选
- 跳转提交申请
- 对 `pending` 申请做取消

### `AgentRequestCreatePage`

作用：

- 提交新申请
- 选择脚本
- 输入 TV 用户
- 上传付款凭证
- 填写金额与备注

说明：

- 代理端当前不做最终 TV 用户标准化
- 最终校验与标准化以管理端审核前为准

### `AgentRequestDetailPage`

作用：

- 查看申请详情
- 查看付款凭证
- `pending` 状态可取消

### `AgentCustomerListPage`

作用：

- 查看当前代理名下客户
- 创建客户

### `AgentCustomerDetailPage`

作用：

- 查看单个客户及其订阅情况

### `AgentTVRegisterPage`

作用：

- 提供 TradingView 注册流程引导页
- 对接外部 TradingView 注册链接

### `AgentScriptListPage`

作用：

- 展示当前可售脚本目录
- 偏目录浏览，不承担编辑能力

## 7. 当前组件体系

## 7.1 布局组件

位于 `qianduan/src/components/layout/`

- `AppLayout`
  - 后台整体骨架
  - 桌面端固定 Sidebar
  - 移动端抽屉式侧栏
- `Sidebar`
  - 按角色渲染导航
- `BreadcrumbBar`
  - 页面标题、面包屑、移动端菜单入口
- `AccountMenu`
  - 账户信息、退出等操作

## 7.2 通用业务组件

当前已形成的核心通用组件包括：

- `PageHeader`
- `PageSkeleton`
- `MetricCard`
- `DataTable`
- `PaginationBar`
- `PropertyRow`
- `StatusBadge`
- `PlanTypeBadge`
- `PlanTypeSelect`
- `ScriptSelect`
- `TVUsernameInput`
- `ConfirmDialog`
- `RejectDialog`
- `SubscriptionRenewDialog`
- `PaymentProofUploader`
- `PaymentProofCard`
- `CookieStatusCard`
- `AuditReportTable`
- `AuthorizedUsersPanel`
- `SubAdminPasswordResetDialog`
- `AgentPasswordResetDialog`

### 7.3 组件风格特点

当前 UI 不是通用白底 CRUD，而是偏“紧凑控制台”：

- 较高信息密度
- 小间距栅格
- 统一边框与卡片表面
- 图表化总览页
- 以状态色做局部强调，不靠大段说明文案

## 8. 当前 API 层结构

目录：`qianduan/src/api/`

### 8.1 公共 API

- `auth.ts`
- `http.ts`
- `system.ts`
- `scripts.ts`
- `reviews.ts`
- `subscriptions.ts`
- `customers.ts`
- `agents.ts`
- `sub-admins.ts`

### 8.2 代理端 API

目录：`qianduan/src/api/agent/`

- `auth.ts`
- `customers.ts`
- `requests.ts`
- `scripts.ts`
- `stats.ts`

### 8.3 当前 HTTP 层特点

`qianduan/src/api/http.ts` 已经统一封装：

- `adminHttp`
- `agentHttp`
- 自动解包响应 envelope
- 业务错误转 `ApiError`
- 401 自动 refresh
- refresh 失败清空 session
- 全局通知错误提示

## 9. 当前状态管理

### 9.1 Auth Store

`qianduan/src/store/auth-store.ts`

当前保存内容：

- `user`
- `authScope`

主要方法：

- `setSession`
- `updateUser`
- `clearSession`
- `isAuthenticated`

说明：

- 已不再持久化 access token / refresh token

### 9.2 Server State

大多数列表、详情、统计页数据统一交给 TanStack Query：

- 请求缓存
- 自动重试
- 刷新后重取
- 页面级 loading / error 状态

## 10. 当前文件结构

```text
qianduan/
├── src/
│   ├── api/
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   │   ├── admin/
│   │   └── agent/
│   ├── store/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   ├── router.tsx
│   └── index.css
├── design-guide/
├── package.json
└── ...
```

## 11. 当前交互与反馈策略

### 11.1 页面加载

当前使用：

- `PageSkeleton`
- 局部 `Skeleton`
- 页面顶部细进度条

其中顶部进度条在 `App.tsx` 中通过 `useIsFetching()` 驱动，属于“非阻塞式后台刷新提示”。

### 11.2 错误提示

当前错误反馈主要由 `http.ts` 统一处理：

- 会话失效
- 权限不足
- TV Cookie 失效
- 服务端内部错误
- 网络错误

通过全局通知组件呈现。

### 11.3 付款凭证

当前付款凭证链路已经成型：

- 上传组件
- 状态徽标
- 卡片查看
- 原图打开

这部分已不再是简单 URL 字段展示。

## 12. 响应式策略

当前布局已兼容桌面端与移动端：

- 桌面端：固定侧边栏 + 可滚动主内容
- 移动端：抽屉导航
- 页面卡片和栅格会根据断点自动折叠

设计取向上仍以桌面后台为主，移动端用于查看和轻量操作，不追求和桌面端完全同构。

## 13. 当前实现与旧设计的关键差异

以下必须以当前代码为准：

1. 角色不是三角色，而是四角色，已包含 `sub_admin`
2. agent 管理不再是 `super_admin` 独占，当前 `sub_admin` 也可访问
3. 前端主链路不再使用 localStorage 持久化 token
4. Axios 现在是 Cookie 驱动的会话刷新方案
5. 管理端 Dashboard 与代理端 Dashboard 都已经重构为高密度图表型页面，不是早期纯数字卡片
6. 代理端已新增 `AgentTVRegisterPage`
7. 子管理员管理页已经落地，不再只是规划
8. 设置页现在不仅管 TV Cookie，还包含快照同步、授权审计和操作日志

## 14. 当前前端结论

当前前端可以定义为：

> 一套基于 React 的多角色后台单页应用，以紧凑控制台风格承载管理端与代理端业务，核心特征是 Cookie 会话、角色路由分组、脚本作用域约束和图表化总览页。

后续如果继续演进，应该优先保持：

- 角色权限口径一致
- 文档与代码同步
- 页面风格统一
- 通用业务组件沉淀
