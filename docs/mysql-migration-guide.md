# PostgreSQL → MySQL 迁移 + 代码质量修复指南

## 前置准备

MySQL 连接信息：
- host: localhost
- port: 3306
- user: your_db_user
- password: your_db_password
- dbname: tv_distribution

### 替换 Go 依赖

在项目根目录执行：

```bash
go get gorm.io/driver/mysql@latest
go mod tidy
```

这会自动添加 mysql 驱动并清理掉不再使用的 postgres 驱动。

---

## 第一步：修改配置文件 config/config.yaml

把 database 部分改成：

```yaml
database:
  host: localhost
  port: 3306
  user: your_db_user
  password: your_db_password
  dbname: tv_distribution
```

删掉原来的 `sslmode: disable` 这一行，MySQL 不需要。

---

## 第二步：修改 internal/config/config.go

找到 `DatabaseConfig` 结构体，做两处改动：

**改动 1**：删掉 `SSLMode` 字段

```go
// 改前
type DatabaseConfig struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
    User     string `mapstructure:"user"`
    Password string `mapstructure:"password"`
    DBName   string `mapstructure:"dbname"`
    SSLMode  string `mapstructure:"sslmode"`    // ← 删掉这行
}
```

```go
// 改后
type DatabaseConfig struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
    User     string `mapstructure:"user"`
    Password string `mapstructure:"password"`
    DBName   string `mapstructure:"dbname"`
}
```

**改动 2**：把 `DSN()` 方法改成 MySQL 格式

```go
// 改前（PostgreSQL DSN）
func (c DatabaseConfig) DSN() string {
    return fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
        c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
    )
}
```

```go
// 改后（MySQL DSN）
func (c DatabaseConfig) DSN() string {
    return fmt.Sprintf(
        "%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=UTC",
        c.User, c.Password, c.Host, c.Port, c.DBName,
    )
}
```

---

## 第三步：修改 cmd/server/main.go

**改动 1**：替换 import

```go
// 改前
import "gorm.io/driver/postgres"

// 改后
import "gorm.io/driver/mysql"
```

**改动 2**：替换数据库连接

```go
// 改前
db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})

// 改后
db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
```

**改动 3**：删掉 PostgreSQL 专有的 partial unique index

找到这段代码，整段删掉：

```go
// 删掉这整段
if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_unique ON subscriptions (customer_id, script_id) WHERE status = 'active'").Error; err != nil {
    logger.Fatal("failed to create partial unique index", zap.Error(err))
}
```

不需要替代方案，因为代码里已经在 `DirectGrant` 和 `SubmitRequest` 中用 `COUNT` 查询做了应用层校验。

---

## 第四步：修改 Model 层的 GORM 标签

### 4.1 internal/model/system_user.go

```go
// 改前
CommissionRate float64 `gorm:"type:numeric(5,4);default:0" json:"commission_rate"`

// 改后
CommissionRate float64 `gorm:"type:decimal(5,4);default:0" json:"commission_rate"`
```

### 4.2 internal/model/script.go

把所有 `numeric` 改成 `decimal`：

```go
// 改前
MonthlyPrice   float64 `gorm:"type:numeric(10,2);default:0" json:"monthly_price"`
QuarterlyPrice float64 `gorm:"type:numeric(10,2);default:0" json:"quarterly_price"`
YearlyPrice    float64 `gorm:"type:numeric(10,2);default:0" json:"yearly_price"`
LifetimePrice  float64 `gorm:"type:numeric(10,2);default:0" json:"lifetime_price"`

// 改后
MonthlyPrice   float64 `gorm:"type:decimal(10,2);default:0" json:"monthly_price"`
QuarterlyPrice float64 `gorm:"type:decimal(10,2);default:0" json:"quarterly_price"`
YearlyPrice    float64 `gorm:"type:decimal(10,2);default:0" json:"yearly_price"`
LifetimePrice  float64 `gorm:"type:decimal(10,2);default:0" json:"lifetime_price"`
```

### 4.3 internal/model/access_request.go

```go
// 改前
Amount float64 `gorm:"type:numeric(10,2);default:0" json:"amount"`

// 改后
Amount float64 `gorm:"type:decimal(10,2);default:0" json:"amount"`
```

### 4.4 internal/model/operation_log.go

```go
// 改前
Detail []byte `gorm:"type:jsonb" json:"detail"`

// 改后
Detail []byte `gorm:"type:json" json:"detail"`
```

---

## 第五步：修改 Service 层的 SQL 语法

MySQL 不支持 `ILIKE`（PostgreSQL 专有的不区分大小写模糊匹配）。
MySQL 的 `LIKE` 默认就是不区分大小写的（utf8mb4_unicode_ci 排序规则），所以直接把 `ILIKE` 替换成 `LIKE` 即可。

需要改 4 个文件，每个文件搜索 `ILIKE` 替换成 `LIKE`：

### 5.1 internal/service/customer_service.go

```go
// 改前
query = query.Where("tv_username ILIKE ? OR contact ILIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")

// 改后
query = query.Where("tv_username LIKE ? OR contact LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
```

### 5.2 internal/service/script_service.go

```go
// 改前
query = query.Where("name ILIKE ? OR pine_id ILIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")

// 改后
query = query.Where("name LIKE ? OR pine_id LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
```

### 5.3 internal/service/auth_service.go

```go
// 改前
query = query.Where("username ILIKE ? OR display_name ILIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")

// 改后
query = query.Where("username LIKE ? OR display_name LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
```

### 5.4 internal/service/subscription_service.go

```go
// 改前
query = query.Where("customers.tv_username ILIKE ?", "%"+filter.CustomerKeyword+"%")

// 改后
query = query.Where("customers.tv_username LIKE ?", "%"+filter.CustomerKeyword+"%")
```

---

## 第六步：修改 go.mod 的 import

执行以下命令清理依赖：

```bash
go mod tidy
```

这会自动移除 `gorm.io/driver/postgres` 和相关的 `pgx` 依赖，添加 MySQL 驱动依赖。

---

## 第七步：验证编译

```bash
go build ./...
```

如果编译通过，说明迁移完成。

---

## 第八步：首次运行

确保 MySQL 已启动且数据库已创建，然后：

```bash
go run cmd/server/main.go
```

GORM 的 `AutoMigrate` 会自动创建所有表。超级管理员账号会根据配置文件自动初始化（见下方配置）。

---

## 改动文件清单（共 11 个文件）

| # | 文件 | 改动内容 |
|---|------|----------|
| 1 | config/config.yaml | 数据库配置改 MySQL 格式 |
| 2 | internal/config/config.go | 删 SSLMode，DSN 改 MySQL 格式 |
| 3 | cmd/server/main.go | import 换 mysql 驱动，删 partial index |
| 4 | internal/model/system_user.go | numeric → decimal |
| 5 | internal/model/script.go | numeric → decimal（4处） |
| 6 | internal/model/access_request.go | numeric → decimal |
| 7 | internal/model/operation_log.go | jsonb → json |
| 8 | internal/service/customer_service.go | ILIKE → LIKE |
| 9 | internal/service/script_service.go | ILIKE → LIKE |
| 10 | internal/service/auth_service.go | ILIKE → LIKE |
| 11 | internal/service/subscription_service.go | ILIKE → LIKE |

---

## 待后续补充的功能

以下功能当前是占位/简化实现，后续需要补充：

| 功能 | 当前状态 | 位置 |
|------|----------|------|
| 限流中间件 | 用内存 map 实现，多实例部署会失效 | internal/middleware/ratelimit.go |
| 操作日志中间件 | 只注入了 IP，没有自动记录请求日志 | internal/middleware/operation_log.go |

---

## 联调发现的问题及修复

### 问题 1：MySQL 字符集必须是 utf8mb4

脚本名称包含 emoji（如 `🤖TF- Algo F1.0🤖`），MySQL 默认的 `utf8` 编码只支持 3 字节字符，无法存储 4 字节的 emoji。

**修复方式**：确保数据库和所有表都使用 `utf8mb4`：

```sql
-- 修改数据库默认字符集
ALTER DATABASE tv_distribution CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 修改所有表（如果已经建表了）
ALTER TABLE scripts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE system_users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE customers CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE access_requests CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE subscriptions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE operation_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE system_settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**预防方式**：建库时就指定字符集：

```sql
CREATE DATABASE tv_distribution CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

DSN 中的 `charset=utf8mb4` 只影响连接层编码，不影响建表时的默认字符集。

### 问题 2：Go 程序需要配置 HTTP 代理

如果你的网络环境需要代理才能访问 `cn.tradingview.com`，Go 的 `net/http` 客户端不会自动读取 Windows 系统代理设置，需要通过环境变量显式指定。

**启动时设置代理**：

```bash
# Linux / Mac
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897
./tv-server

# Windows PowerShell
$env:HTTP_PROXY = "http://127.0.0.1:7897"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
./tv-server.exe
```

把 `127.0.0.1:7897` 替换成你实际的代理地址。如果不需要代理则无需设置。

### 问题 3：超级管理员账号自动初始化

每次手动插 SQL 创建超管很麻烦。改为在 `config.yaml` 中配置默认超管信息，服务启动时自动检查并创建。

**config.yaml 新增配置**：

```yaml
admin:
  username: your_admin_username
  password: your_admin_password
  display_name: 超级管理员
```

**config.go 新增结构体**：

```go
type AdminConfig struct {
    Username    string `mapstructure:"username"`
    Password    string `mapstructure:"password"`
    DisplayName string `mapstructure:"display_name"`
}
```

在 `Config` 结构体中加一个字段：

```go
type Config struct {
    // ... 已有字段
    Admin AdminConfig `mapstructure:"admin"`
}
```

**main.go 中 AutoMigrate 之后加初始化逻辑**：

```go
// 自动初始化超级管理员
if cfg.Admin.Username != "" && cfg.Admin.Password != "" {
    if err := authService.EnsureSuperAdmin(cfg.Admin.Username, cfg.Admin.Password, cfg.Admin.DisplayName); err != nil {
        logger.Fatal("failed to initialize super admin", zap.Error(err))
    }
}
```

**auth_service.go 新增方法**：

```go
func (s *AuthService) EnsureSuperAdmin(username, password, displayName string) error {
    var count int64
    if err := s.db.Model(&model.SystemUser{}).
        Where("username = ? AND role = ?", username, model.RoleSuperAdmin).
        Count(&count).Error; err != nil {
        return err
    }
    if count > 0 {
        return nil // 已存在，跳过
    }

    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return err
    }
    user := model.SystemUser{
        Username:     username,
        PasswordHash: string(hash),
        Role:         model.RoleSuperAdmin,
        DisplayName:  displayName,
        Status:       1,
    }
    return s.db.Create(&user).Error
}
```

这样首次启动自动创建超管，后续启动检测到已存在则跳过，不会重复创建。
