# Sub-Admin（子管理员）功能开发指南

## 一、需求概述

在现有的 `super_admin / admin / agent` 三角色体系基础上，新增 `sub_admin`（子管理员）角色。
`sub_admin` 是一个**受脚本权限约束的管理员**，只能操作被分配的脚本及其关联的所有业务数据（审批、订阅、客户）。

### 角色体系（4个角色）

| 角色 | 定位 | 脚本限制 |
|------|------|----------|
| `super_admin` | 系统管理员 | 无限制 |
| `admin` | 业务管理员 | 无限制 |
| `sub_admin` | 子管理员 | **只能操作被分配的脚本** |
| `agent` | 代理 | 不直接管理脚本 |

### 管理关系

- `super_admin` 可以管理：`admin`、`sub_admin`、`agent`
- `admin` 可以管理：`sub_admin`
- `sub_admin` 不能管理任何用户

---

## 二、数据库变更 ✅ 已完成

### 2.1 新增表：`user_script_permissions` ✅

已在数据库中创建，实际建表语句：

```sql
CREATE TABLE `user_script_permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `user_id` bigint(20) unsigned NOT NULL COMMENT '子管理员的 system_users.id',
  `script_id` bigint(20) unsigned NOT NULL COMMENT 'scripts.id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_script` (`user_id`,`script_id`),
  KEY `idx_user_script_permissions_user_id` (`user_id`),
  KEY `idx_user_script_permissions_script_id` (`script_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='子管理员脚本权限关联表';
```

### 2.2 修改表：`customers` — 新增 `created_by` 字段 ✅

已在数据库中执行，用于追踪客户创建者（解决 sub_admin 创建客户后因无订阅关系而"丢失"的问题）。

```sql
ALTER TABLE `customers`
  ADD COLUMN `created_by` bigint(20) unsigned DEFAULT NULL COMMENT '创建者的 system_users.id' AFTER `agent_id`,
  ADD KEY `idx_customers_created_by` (`created_by`);
```

---

## 三、Model 层变更

### 3.1 新增常量 `internal/model/system_user.go`

```go
const (
    RoleSuperAdmin = "super_admin"
    RoleAdmin      = "admin"
    RoleSubAdmin   = "sub_admin"  // 新增
    RoleAgent      = "agent"
)
```

### 3.2 新增模型 `internal/model/user_script_permission.go`

```go
package model

type UserScriptPermission struct {
    BaseModel
    UserID   uint64 `gorm:"not null;uniqueIndex:uk_user_script" json:"user_id"`
    ScriptID uint64 `gorm:"not null;uniqueIndex:uk_user_script" json:"script_id"`

    User   SystemUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
    Script Script     `gorm:"foreignKey:ScriptID" json:"script,omitempty"`
}

func (UserScriptPermission) TableName() string {
    return "user_script_permissions"
}
```

### 3.3 修改模型 `internal/model/customer.go`

```go
type Customer struct {
    BaseModel
    TVUsername string  `gorm:"size:100;uniqueIndex;not null" json:"tv_username"`
    TVUserID   *uint64 `json:"tv_user_id"`
    Contact    string  `gorm:"size:200" json:"contact"`
    Remark     string  `gorm:"type:text" json:"remark"`
    AgentID    *uint64 `gorm:"index" json:"agent_id"`
    CreatedBy  *uint64 `gorm:"index" json:"created_by"` // 新增
}
```

### 3.4 注册新模型 `internal/model/base.go`

在 `AllModels()` 中添加 `&UserScriptPermission{}`。

---

## 四、错误码 `internal/pkg/errcode/errcode.go`

新增以下错误码：

```go
var (
    ErrSubAdminNotFound    = New(10600, "sub admin not found", http.StatusNotFound)
    ErrSubAdminUsernameDup = New(10601, "sub admin username already exists", http.StatusBadRequest)
    ErrScriptNotPermitted  = New(10602, "no permission for this script", http.StatusForbidden)
)
```

---

## 五、中间件层变更

### 5.1 新增中间件 `internal/middleware/script_scope.go`

核心思路：对 `sub_admin` 用户，查询其被分配的脚本ID列表并注入到 `gin.Context` 中。
`admin` 和 `super_admin` 不注入（表示无限制）。

```go
package middleware

import (
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "tv-distribution/internal/model"
)

const scopedScriptIDsKey = "scoped_script_ids"

// InjectScriptScope 为 sub_admin 注入允许操作的脚本ID列表
// admin 和 super_admin 不注入，表示无限制
func InjectScriptScope(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        claims := CurrentUser(c)
        if claims == nil || claims.Role != model.RoleSubAdmin {
            c.Next()
            return
        }

        var scriptIDs []uint64
        if err := db.Model(&model.UserScriptPermission{}).
            Where("user_id = ?", claims.UserID).
            Pluck("script_id", &scriptIDs).Error; err != nil {
            // 查询失败时快速失败，不允许继续
            response.Error(c, errcode.ErrInternal)
            c.Abort()
            return
        }

        // 即使为空也注入，空列表意味着没有任何脚本权限
        c.Set(scopedScriptIDsKey, scriptIDs)
        c.Next()
    }
}

// ScopedScriptIDs 从 Context 获取脚本权限范围
// 返回值：scriptIDs, isScopedUser
// - isScopedUser=false 表示当前用户不受脚本权限限制（admin/super_admin）
// - isScopedUser=true  表示当前用户受限，scriptIDs 为允许的脚本ID列表
func ScopedScriptIDs(c *gin.Context) ([]uint64, bool) {
    v, exists := c.Get(scopedScriptIDsKey)
    if !exists {
        return nil, false
    }
    ids, ok := v.([]uint64)
    if !ok {
        return nil, false
    }
    return ids, true
}
```

**性能说明**：每次请求查一次 `user_script_permissions` 表，数据量小（一个 sub_admin 通常只分配几个到几十个脚本），走 `idx_user_id` 索引，性能无问题。如果未来 sub_admin 数量很大，可以考虑加 Redis 缓存，但当前阶段不需要。

### 5.2 `internal/middleware/role.go` — 无需修改

现有的 `RequireRoles` 中间件基于 `slices.Contains` 匹配角色，天然支持新角色，只需在路由注册时把 `model.RoleSubAdmin` 加进去即可。

---

## 六、Service 层变更

### 6.1 核心原则：`allowedScriptIDs` 参数透传

所有涉及脚本数据过滤的 Service 方法，统一增加一个可选参数来接收脚本权限范围。
推荐使用一个结构体封装，避免方法签名膨胀：

```go
// internal/service/scope.go（新文件）
package service

// ScriptScope 表示当前操作者的脚本权限范围
// Scoped=false 表示不受限（admin/super_admin）
// Scoped=true  表示受限，ScriptIDs 为允许的脚本ID列表
type ScriptScope struct {
    Scoped    bool
    ScriptIDs []uint64
}

// Unrestricted 返回一个不受限的 scope（admin/super_admin 使用）
func Unrestricted() ScriptScope {
    return ScriptScope{Scoped: false}
}

// RestrictedTo 返回一个受限的 scope（sub_admin 使用）
func RestrictedTo(ids []uint64) ScriptScope {
    return ScriptScope{Scoped: true, ScriptIDs: ids}
}

// ApplyToQuery 将脚本权限范围应用到 GORM 查询
// scriptIDColumn 是查询中脚本ID字段的列名，如 "script_id" 或 "subscriptions.script_id"
func (s ScriptScope) ApplyToQuery(query *gorm.DB, scriptIDColumn string) *gorm.DB {
    if !s.Scoped {
        return query
    }
    return query.Where(scriptIDColumn+" IN ?", s.ScriptIDs)
}
```

### 6.2 `internal/service/script_service.go` 变更

#### `List` 方法

```go
// 修改前
func (s *ScriptService) List(filter ScriptListFilter, activeOnly bool) (*PageResult, error)

// 修改后 — 增加 scope 参数
func (s *ScriptService) List(filter ScriptListFilter, activeOnly bool, scope ScriptScope) (*PageResult, error)
```

在构建 query 后、执行 Count 前，加入：
```go
query = scope.ApplyToQuery(query, "id")
```

#### `GetByID` 方法

```go
// 修改后 — 增加 scope 参数
func (s *ScriptService) GetByID(id uint64, scope ScriptScope) (*model.Script, error)
```

查询时加入脚本权限校验：
```go
query := s.db.Where("id = ?", id)
query = scope.ApplyToQuery(query, "id")
if err := query.First(&item).Error; err != nil {
    // ...
}
```

#### `Update` 方法

```go
// 修改后
func (s *ScriptService) Update(id uint64, dto UpdateScriptDTO, scope ScriptScope) (*model.Script, error)
```

内部调用 `GetByID(id, scope)` 即可自动校验权限。

### 6.3 `internal/service/review_service.go` 变更

#### `ListPendingRequests` 方法

```go
// 修改后
func (s *ReviewService) ListPendingRequests(filter RequestFilter, scope ScriptScope) (*PageResult, error)
```

在构建 query 后加入：
```go
query = scope.ApplyToQuery(query, "script_id")
```

#### `ApproveRequest` 方法

```go
// 修改后
func (s *ReviewService) ApproveRequest(reviewerID, requestID uint64, scope ScriptScope) error
```

在查询 AccessRequest 后、执行审批前，校验脚本权限：
```go
if scope.Scoped {
    if !slices.Contains(scope.ScriptIDs, request.ScriptID) {
        return errcode.ErrScriptNotPermitted
    }
}
```

#### `RejectRequest` 方法 — 同 `ApproveRequest`，增加 scope 校验

#### `BatchApprove` 方法

```go
// 修改后
func (s *ReviewService) BatchApprove(reviewerID uint64, requestIDs []uint64, scope ScriptScope) (*BatchResult, error)
```

批量查询请求后，过滤掉不在权限范围内的请求（或直接报错）。

### 6.4 `internal/service/subscription_service.go` 变更

#### `List` 方法

```go
// 修改后
func (s *SubscriptionService) List(filter SubscriptionFilter, scope ScriptScope) (*PageResult, error)
```

加入：
```go
query = scope.ApplyToQuery(query, "subscriptions.script_id")
```

#### `DirectGrant` 方法

```go
// 修改后
func (s *SubscriptionService) DirectGrant(operatorID uint64, dto DirectGrantDTO, scope ScriptScope) (*model.Subscription, error)
```

在创建订阅前校验：
```go
if scope.Scoped {
    if !slices.Contains(scope.ScriptIDs, dto.ScriptID) {
        return nil, errcode.ErrScriptNotPermitted
    }
}
```

#### `DirectRenew` / `Revoke` / `GetByID` 方法 — 同理，查询订阅后校验其 ScriptID 是否在 scope 内

### 6.5 `internal/service/customer_service.go` 变更

#### `List` 方法

```go
// 修改后
func (s *CustomerService) List(filter CustomerFilter, scope ScriptScope) (*PageResult, error)
```

sub_admin 的客户可见范围 = 有订阅关系的客户 + 自己创建的客户：
```go
if scope.Scoped {
    // 子查询：通过订阅关系关联的客户 UNION 自己创建的客户
    query = query.Where(
        "id IN (SELECT customer_id FROM subscriptions WHERE script_id IN ?) OR created_by = ?",
        scope.ScriptIDs, currentUserID,
    )
}
```

**注意**：这里需要额外传入 `currentUserID`，建议在 `CustomerFilter` 中增加一个 `CreatedBy *uint64` 字段，或者将 `currentUserID` 放入 `ScriptScope` 结构体中。

推荐方案：扩展 `ScriptScope`：
```go
type ScriptScope struct {
    Scoped    bool
    ScriptIDs []uint64
    UserID    uint64  // 当前操作者ID，用于 created_by 查询
}
```

#### `GetByID` 方法

```go
// 修改后
func (s *CustomerService) GetByID(id uint64, agentID *uint64, scope ScriptScope) (*CustomerDetail, error)
```

- 查询客户时，校验客户是否在 scope 可见范围内（有订阅关系或 created_by 匹配）
- 查询订阅列表时，过滤只返回 scope 内脚本的订阅：
```go
subQuery := s.db.Preload("Script").Where("customer_id = ?", customer.ID)
if scope.Scoped {
    subQuery = subQuery.Where("script_id IN ?", scope.ScriptIDs)
}
```

#### `Create` 方法

```go
// 修改后
func (s *CustomerService) Create(dto CreateCustomerDTO, createdBy *uint64) (*model.Customer, error)
```

创建客户时写入 `created_by` 字段：
```go
customer := model.Customer{
    TVUsername: dto.TVUsername,
    TVUserID:   &tvID,
    Contact:    dto.Contact,
    Remark:     dto.Remark,
    AgentID:    dto.AgentID,
    CreatedBy:  createdBy,  // 新增
}
```

#### `Update` 方法 — 增加 scope 校验，确保客户在可见范围内

---

## 七、Service 层 — Sub-Admin 管理（CRUD + 脚本权限分配）

### 7.1 新增 DTO

在 `internal/service/auth_service.go` 中新增：

```go
type CreateSubAdminDTO struct {
    Username    string   `json:"username" binding:"required"`
    Password    string   `json:"password" binding:"required,min=6"`
    DisplayName string   `json:"display_name"`
    Status      *int16   `json:"status"`
    ScriptIDs   []uint64 `json:"script_ids"` // 初始分配的脚本ID列表
}

type UpdateSubAdminDTO struct {
    DisplayName *string `json:"display_name"`
    Status      *int16  `json:"status"`
}

type UpdateSubAdminScriptsDTO struct {
    ScriptIDs []uint64 `json:"script_ids" binding:"required"` // 全量替换
}

type SubAdminDetailDTO struct {
    ID          uint64    `json:"id"`
    Username    string    `json:"username"`
    DisplayName string    `json:"display_name"`
    Role        string    `json:"role"`
    Status      int16     `json:"status"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
    Scripts     []Script  `json:"scripts"` // 已分配的脚本列表
}
```

### 7.2 新增方法

在 `internal/service/auth_service.go` 中新增以下方法（参考现有的 Agent 管理方法模式）：

#### `CreateSubAdmin`

```go
func (s *AuthService) CreateSubAdmin(dto CreateSubAdminDTO) (*model.SystemUser, error)
```

逻辑：
1. 校验用户名唯一性（复用 `ensureAgentUsernameAvailable` 或抽取为通用方法 `ensureUsernameAvailable`）
2. 校验 Status（复用 `validateAgentStatus` 或重命名为通用方法）
3. bcrypt 加密密码
4. 创建 `SystemUser`，Role 设为 `model.RoleSubAdmin`，CommissionRate 设为 0
5. 如果 `dto.ScriptIDs` 非空，批量创建 `UserScriptPermission` 记录
6. 使用事务包裹步骤 4-5

#### `ListSubAdmins`

```go
func (s *AuthService) ListSubAdmins(filter SubAdminListFilter) (*PageResult, error)
```

查询 `system_users WHERE role = 'sub_admin'`，支持关键词搜索、状态过滤、分页。

#### `GetSubAdminDetail`

```go
func (s *AuthService) GetSubAdminDetail(id uint64) (*SubAdminDetailDTO, error)
```

查询用户基本信息 + 关联查询已分配的脚本列表。

#### `UpdateSubAdmin`

```go
func (s *AuthService) UpdateSubAdmin(id uint64, dto UpdateSubAdminDTO) (*model.SystemUser, error)
```

只更新基本信息（DisplayName、Status），不涉及脚本权限。

#### `UpdateSubAdminScripts`

```go
func (s *AuthService) UpdateSubAdminScripts(id uint64, dto UpdateSubAdminScriptsDTO) error
```

逻辑（全量替换策略）：
1. 校验用户存在且角色为 `sub_admin`
2. 校验所有 ScriptID 存在
3. 事务内：删除该用户所有旧的 `UserScriptPermission` → 批量插入新记录
4. 允许传空数组（清空所有脚本权限）

#### `ResetSubAdminPassword`

```go
func (s *AuthService) ResetSubAdminPassword(id uint64, dto ResetAgentPasswordDTO) error
```

复用现有的密码重置逻辑，校验目标用户角色为 `sub_admin`。

---

## 八、Handler 层变更

### 8.1 新增 `internal/handler/admin/sub_admin_mgmt.go`

参考 `agent_mgmt.go` 的模式，创建 `SubAdminMgmtHandler`：

```go
type SubAdminMgmtHandler struct {
    auth *service.AuthService
}

func NewSubAdminMgmtHandler(auth *service.AuthService) *SubAdminMgmtHandler
func (h *SubAdminMgmtHandler) List(c *gin.Context)
func (h *SubAdminMgmtHandler) Create(c *gin.Context)
func (h *SubAdminMgmtHandler) Get(c *gin.Context)
func (h *SubAdminMgmtHandler) Update(c *gin.Context)
func (h *SubAdminMgmtHandler) ResetPassword(c *gin.Context)
func (h *SubAdminMgmtHandler) UpdateScripts(c *gin.Context)  // PUT /sub-admins/:id/scripts
```

### 8.2 修改现有 Handler — 注入 ScriptScope

所有涉及脚本数据的 admin handler 都需要从 `gin.Context` 中提取 `ScriptScope` 并传给 service。

提取逻辑封装为一个辅助函数，放在 `internal/handler/admin/common.go`：

```go
func extractScriptScope(c *gin.Context) service.ScriptScope {
    ids, scoped := middleware.ScopedScriptIDs(c)
    if !scoped {
        return service.Unrestricted()
    }
    user := middleware.CurrentUser(c)
    return service.ScriptScope{
        Scoped:    true,
        ScriptIDs: ids,
        UserID:    user.UserID,
    }
}
```

#### 需要修改的 Handler 文件：

| 文件 | 需要修改的方法 | 改动说明 |
|------|---------------|---------|
| `script.go` | `List`, `Get`, `Update` | 调用 service 时传入 `extractScriptScope(c)` |
| `review.go` | `List`, `Get`, `Approve`, `Reject`, `BatchApprove` | 同上 |
| `subscription.go` | `List`, `Get`, `Create`, `Renew`, `Revoke` | 同上 |
| `customer.go` | `List`, `Get`, `Create`, `Update` | 同上，Create 额外传入 `createdBy` |
| `dashboard.go` | `Stats` | 统计查询加入 scope 过滤 |

---

## 九、Router 层变更 `internal/router/router.go`

### 9.1 修改 `registerAdminRoutes`

```go
func registerAdminRoutes(engine *gin.Engine, services Services) {
    // ... 现有 handler 初始化 ...
    subAdminMgmtH := adminHandler.NewSubAdminMgmtHandler(services.Auth) // 新增

    // ... 登录路由不变 ...

    // ===== protected 路由组 =====
    // 修改：加入 RoleSubAdmin，加入 InjectScriptScope 中间件
    protected := base.Group("")
    protected.Use(middleware.JWTAuth(services.Auth))
    protected.Use(middleware.RequireRoles(model.RoleAdmin, model.RoleSubAdmin, model.RoleSuperAdmin))
    protected.Use(middleware.InjectScriptScope(services.DB)) // 新增

    // 个人资料 — sub_admin 可用，无需脚本权限
    protected.GET("/auth/profile", authH.Profile)
    protected.PUT("/auth/profile", authH.UpdateProfile)
    protected.PUT("/auth/password", authH.ChangePassword)

    // 脚本管理 — sub_admin 受 scope 限制（在 handler/service 层过滤）
    // 注意：Sync 和 Users 需要单独限制
    protected.GET("/scripts", scriptH.List)
    protected.GET("/scripts/:id", scriptH.Get)
    protected.PUT("/scripts/:id", scriptH.Update)

    // 审批管理 — sub_admin 受 scope 限制
    protected.GET("/reviews", reviewH.List)
    protected.GET("/reviews/:id", reviewH.Get)
    protected.POST("/reviews/:id/approve", reviewH.Approve)
    protected.POST("/reviews/:id/reject", reviewH.Reject)
    protected.POST("/reviews/batch-approve", reviewH.BatchApprove)

    // 订阅管理 — sub_admin 受 scope 限制
    protected.GET("/subscriptions", subH.List)
    protected.POST("/subscriptions", subH.Create)
    protected.POST("/subscriptions/:id/renew", subH.Renew)
    protected.POST("/subscriptions/:id/revoke", subH.Revoke)
    protected.GET("/subscriptions/:id", subH.Get)

    // 客户管理 — sub_admin 受 scope 限制
    protected.GET("/customers", customerH.List)
    protected.POST("/customers", customerH.Create)
    protected.GET("/customers/:id", customerH.Get)
    protected.PUT("/customers/:id", customerH.Update)
    protected.GET("/tv/validate-username", customerH.ValidateTVUsername)

    // Dashboard — sub_admin 受 scope 限制
    protected.GET("/dashboard/stats", dashboardH.Stats)

    // ===== admin 专属路由（sub_admin 不可访问）=====
    adminOnly := protected.Group("")
    adminOnly.Use(middleware.RequireRoles(model.RoleAdmin, model.RoleSuperAdmin))
    adminOnly.POST("/scripts/sync", scriptH.Sync)
    adminOnly.GET("/scripts/:id/users", scriptH.Users)
    adminOnly.GET("/system/tv-session", tvH.Status)
    adminOnly.PUT("/system/tv-cookies", tvH.Update)
    adminOnly.POST("/system/sync-access", tvH.SyncAccess)
    adminOnly.POST("/system/sync-tv-access", tvH.SyncTVAccess)
    adminOnly.GET("/system/operation-logs", tvH.OperationLogs)
    adminOnly.GET("/system/tv-access-overview", tvH.TVAccessOverview)

    // ===== sub_admin 管理路由（admin + super_admin 可访问）=====
    subAdminMgmt := protected.Group("")
    subAdminMgmt.Use(middleware.RequireRoles(model.RoleAdmin, model.RoleSuperAdmin))
    subAdminMgmt.GET("/sub-admins", subAdminMgmtH.List)
    subAdminMgmt.POST("/sub-admins", subAdminMgmtH.Create)
    subAdminMgmt.GET("/sub-admins/:id", subAdminMgmtH.Get)
    subAdminMgmt.PUT("/sub-admins/:id", subAdminMgmtH.Update)
    subAdminMgmt.POST("/sub-admins/:id/reset-password", subAdminMgmtH.ResetPassword)
    subAdminMgmt.PUT("/sub-admins/:id/scripts", subAdminMgmtH.UpdateScripts)

    // ===== super_admin 专属路由（不变）=====
    superAdmin := protected.Group("")
    superAdmin.Use(middleware.RequireRoles(model.RoleSuperAdmin))
    superAdmin.GET("/agents", agentMgmtH.List)
    superAdmin.POST("/agents", agentMgmtH.Create)
    superAdmin.PUT("/agents/:id", agentMgmtH.Update)
    superAdmin.POST("/agents/:id/reset-password", agentMgmtH.ResetPassword)
    superAdmin.GET("/agents/:id", agentMgmtH.Get)
}
```

### 9.2 登录入口变更 `internal/service/auth_service.go`

`LoginAdmin` 方法需要把 `sub_admin` 加入允许的角色列表：

```go
func (s *AuthService) LoginAdmin(dto LoginDTO) (*TokenPair, error) {
    // 修改前
    return s.loginWithRoles(dto, model.RoleAdmin, model.RoleSuperAdmin)
    // 修改后
    return s.loginWithRoles(dto, model.RoleAdmin, model.RoleSubAdmin, model.RoleSuperAdmin)
}
```

---

## 十、Dashboard 统计变更 `internal/handler/admin/dashboard.go`

`Stats` 方法需要接收 `ScriptScope`，对 sub_admin 的统计数据做过滤：

```go
func (h *DashboardHandler) Stats(c *gin.Context) {
    scope := extractScriptScope(c)

    // admin/super_admin 的统计逻辑不变

    // sub_admin 的统计逻辑：
    // - admin_count: 不展示或固定为 0（sub_admin 不需要知道有多少管理员）
    // - agent_count: 不展示或固定为 0
    // - customer_count: 只统计 scope 内有订阅关系的客户 + created_by 的客户
    // - pending_request_count: 只统计 scope 内脚本的待审批请求
    // - active_subscription_count: 只统计 scope 内脚本的活跃订阅
    // - approved_amount_month: 只统计 scope 内脚本的本月审批金额

    if scope.Scoped {
        // customer_count
        h.db.Model(&model.Customer{}).
            Where("id IN (SELECT customer_id FROM subscriptions WHERE script_id IN ?) OR created_by = ?",
                scope.ScriptIDs, scope.UserID).
            Count(&customerCount)

        // pending_request_count
        h.db.Model(&model.AccessRequest{}).
            Where("status = ? AND script_id IN ?", model.RequestStatusPending, scope.ScriptIDs).
            Count(&pendingCount)

        // active_subscription_count
        h.db.Model(&model.Subscription{}).
            Where("status = ? AND script_id IN ?", model.SubscriptionStatusActive, scope.ScriptIDs).
            Count(&activeSubCount)

        // approved_amount_month
        h.db.Model(&model.AccessRequest{}).
            Where("status = ? AND reviewed_at >= ? AND script_id IN ?",
                model.RequestStatusApproved, monthStart, scope.ScriptIDs).
            Select("COALESCE(SUM(amount), 0)").
            Scan(&monthAmount)
    }
}
```

---

## 十一、开发顺序建议

按以下顺序开发，每一步都可以独立验证：

```
第1步：数据库 + Model
  ├── 执行 SQL 创建 user_script_permissions 表
  ├── 执行 SQL 给 customers 表加 created_by 字段
  ├── 新增 RoleSubAdmin 常量
  ├── 新增 UserScriptPermission 模型
  ├── 修改 Customer 模型加 CreatedBy 字段
  └── 注册新模型到 AllModels()

第2步：错误码
  └── 新增 ErrSubAdminNotFound、ErrSubAdminUsernameDup、ErrScriptNotPermitted

第3步：中间件
  ├── 新增 script_scope.go（InjectScriptScope + ScopedScriptIDs）
  └── 无需修改 role.go

第4步：Service 层 — ScriptScope 基础设施
  ├── 新增 scope.go（ScriptScope 结构体 + 辅助方法）
  └── 修改各 service 方法签名，加入 scope 参数和过滤逻辑

第5步：Service 层 — Sub-Admin CRUD
  ├── 新增 CreateSubAdmin / ListSubAdmins / GetSubAdminDetail
  ├── 新增 UpdateSubAdmin / UpdateSubAdminScripts / ResetSubAdminPassword
  └── 修改 LoginAdmin 加入 RoleSubAdmin

第6步：Handler 层
  ├── 新增 sub_admin_mgmt.go
  ├── 在 common.go 中新增 extractScriptScope 辅助函数
  ├── 修改现有 handler 传入 scope
  └── 修改 dashboard.go 统计逻辑

第7步：Router 层
  ├── 路由分组调整（protected / adminOnly / subAdminMgmt / superAdmin）
  └── 注册新 handler 和中间件
```

---

## 十二、API 接口汇总

### 新增接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/admin/v1/sub-admins` | admin, super_admin | 子管理员列表 |
| POST | `/api/admin/v1/sub-admins` | admin, super_admin | 创建子管理员 |
| GET | `/api/admin/v1/sub-admins/:id` | admin, super_admin | 子管理员详情（含脚本列表） |
| PUT | `/api/admin/v1/sub-admins/:id` | admin, super_admin | 更新子管理员信息 |
| POST | `/api/admin/v1/sub-admins/:id/reset-password` | admin, super_admin | 重置密码 |
| PUT | `/api/admin/v1/sub-admins/:id/scripts` | admin, super_admin | 分配脚本权限（全量替换） |

### 权限变更的现有接口

| 接口 | 变更说明 |
|------|---------|
| `POST /auth/login` | 允许 sub_admin 登录 |
| 脚本 CRUD（不含 sync/users） | sub_admin 可访问，受 scope 过滤 |
| 审批全部接口 | sub_admin 可访问，受 scope 过滤 |
| 订阅全部接口 | sub_admin 可访问，受 scope 过滤 |
| 客户全部接口 | sub_admin 可访问，受 scope 过滤 |
| Dashboard | sub_admin 可访问，受 scope 过滤 |
| 系统管理全部接口 | sub_admin **不可访问** |
| 脚本同步 / 查看授权用户 | sub_admin **不可访问** |

---

## 十三、注意事项

1. **事务一致性**：创建 sub_admin 时，用户创建和脚本权限分配必须在同一个事务中
2. **脚本删除/禁用**：如果脚本被禁用，sub_admin 的权限记录不需要自动清理，查询时自然会被 status 过滤掉
3. **空权限处理**：如果 sub_admin 没有被分配任何脚本（ScriptIDs 为空），所有业务查询应返回空列表，不应报错
4. **现有数据兼容**：`customers.created_by` 字段为 NULL 表示历史数据，不影响现有逻辑
5. **Agent 路由不受影响**：`registerAgentRoutes` 完全不需要修改
6. **方法重构建议**：现有的 `ensureAgentUsernameAvailable`、`validateAgentStatus` 等方法建议重命名为通用方法（如 `ensureUsernameAvailable`、`validateUserStatus`），避免 sub_admin 管理代码重复这些校验逻辑
