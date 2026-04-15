# TradingView 分销管理系统

一个面向 TradingView 私有脚本分销、授权发放、续费审核、代理协作与访问审计的前后端分离管理系统。

本仓库包含 Go 后端、React 前端，以及围绕架构、接口、迁移和后台设计的项目文档，适合作为内部业务系统持续开发、部署和版本管理的基础代码库。

## 目录

- [项目简介](#项目简介)
- [核心能力](#核心能力)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [角色模型](#角色模型)
- [认证与安全](#认证与安全)
- [仓库结构](#仓库结构)
- [快速开始](#快速开始)
- [构建与部署](#构建与部署)
- [配置说明](#配置说明)
- [开发说明](#开发说明)
- [文档索引](#文档索引)
- [适用场景](#适用场景)
- [当前边界](#当前边界)
- [FAQ](#faq)
- [协作建议](#协作建议)
- [License](#license)

## 项目简介

系统围绕 TradingView 脚本授权场景构建，目标不是内容展示，而是完成一条可运营、可审计、可扩展的业务闭环：

- 代理发起脚本授权或续费申请
- 管理端审核申请并处理客户、订阅、脚本权限
- 系统调用 TradingView 相关接口完成授权同步
- 平台维护客户、订阅、脚本、访问快照与操作日志
- 定时任务负责同步、审计、过期扫描和文件清理

当前实现为单体式后端加独立前端控制台的组合架构：

- 后端：Go + Gin + GORM
- 前端：React 19 + Vite + TypeScript
- 数据库：MySQL
- 外部依赖：TradingView Web 接口

从工程形态上看，这是一个偏“运营后台 + 分销链路 + 授权同步”的业务系统，而不是通用组件库或纯 API 示例项目。

## 核心能力

- 管理端与代理端双入口登录
- `super_admin`、`admin`、`sub_admin`、`agent` 多角色隔离
- 客户、脚本、订阅、审核、代理管理
- TradingView 访问状态同步与审计
- 支付凭证上传与静态文件访问
- 定时任务驱动的同步、清理与巡检机制
- 基于 `JWT + HttpOnly Cookie` 的认证体系

## 技术栈

### 后端

- Go `1.23+`
- Gin
- GORM
- Viper
- Zap
- robfig/cron
- MySQL

### 前端

- React `19`
- Vite `6`
- TypeScript `5`
- Tailwind CSS `4`
- React Router
- TanStack Query
- React Hook Form + Zod
- Zustand

## 系统架构

```text
Browser
  -> Admin Console / Agent Console
  -> React SPA (qianduan/)
  -> /api/* and /uploads/* via Vite proxy in development

Gin Server (cmd/server/main.go)
  -> Router / Middleware
  -> Handler
  -> Service
  -> Scheduler
  -> GORM Models

Infrastructure
  -> MySQL
  -> TradingView Web API
  -> Local uploads and run logs
```

后端启动时会完成以下关键初始化动作：

- 读取 `config/config.yaml`
- 初始化日志与运行模式
- 连接 MySQL 并执行自动迁移
- 装配认证、客户、脚本、审核、订阅、TV 会话、TV 访问同步等服务
- 启动定时任务调度器
- 注册管理端和代理端 API 路由

## 角色模型

当前系统已落地四类角色：

- `super_admin`：全局最高权限
- `admin`：后台核心业务管理权限
- `sub_admin`：受脚本作用域约束的后台管理角色
- `agent`：代理端业务角色，负责申请、客户维护与业务查看

接口分组按照角色边界划分：

- 管理端：`/api/admin/v1`
- 代理端：`/api/agent/v1`
- 健康检查：`/health`
- 上传文件访问：`/uploads/*`

这意味着系统在产品形态上天然分为两条业务视图：

- 管理端：面向审核、配置、全局同步与业务维护
- 代理端：面向申请发起、客户维护与自身业务查询

## 认证与安全

系统当前采用 `JWT + HttpOnly Cookie` 的组合认证方式：

- 后端支持 `Authorization: Bearer <access_token>`
- 前端主链路默认使用 Cookie 会话
- 登录后会写入 `tvd_access_token` 与 `tvd_refresh_token`
- 管理端和代理端分别使用不同的 Cookie Path

安全相关建议：

- 仓库提供 `config/config.example.yaml` 作为配置模板
- 正式环境请替换 `jwt.secret`、管理员初始密码、TradingView 会话信息和加密密钥
- 建议通过环境隔离、最小权限和凭证轮换管理敏感配置

## 仓库结构

```text
tadingview/
├─ cmd/
│  └─ server/                      # 后端启动入口
├─ config/
│  ├─ config.example.yaml          # 示例配置
│  └─ config.yaml                  # 本地实际配置（已建议忽略）
├─ docs/                           # 架构、接口、迁移、前端设计等文档
├─ internal/
│  ├─ config/                      # 配置加载
│  ├─ handler/                     # HTTP 处理器
│  ├─ middleware/                  # 中间件
│  ├─ model/                       # GORM 模型
│  ├─ pkg/                         # 通用包
│  ├─ router/                      # 路由装配
│  ├─ scheduler/                   # 定时任务
│  └─ service/                     # 核心业务服务
├─ qianduan/                       # React 前端
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.ts
├─ test/                           # 测试相关资源
├─ build.sh                        # Linux 打包脚本
├─ go.mod
├─ README.md
└─ LICENSE
```

## 快速开始

### 1. 准备环境

建议准备以下依赖：

- Go `1.23` 或更高版本
- Node.js `18` 或更高版本
- npm
- MySQL `8.x`

### 2. 初始化配置

先从示例配置复制出本地配置：

```bash
copy config\config.example.yaml config\config.yaml
```

至少需要检查并修改以下配置项：

- `server.port`
- `database.host`
- `database.port`
- `database.user`
- `database.password`
- `database.dbname`
- `jwt.secret`
- `security.data_encryption_key`
- `admin.username`
- `admin.password`
- `tradingview.sessionid`
- `tradingview.sessionid_sign`

### 3. 启动后端

在仓库根目录执行：

```bash
go run ./cmd/server
```

默认监听地址：

```text
http://localhost:8080
```

健康检查：

```text
GET /health
```

### 4. 启动前端

进入前端目录并启动开发服务器：

```bash
cd qianduan
npm install
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

开发模式下，Vite 会将以下请求代理到后端：

- `/api` -> `http://localhost:8080`
- `/uploads` -> `http://localhost:8080`

## 构建与部署

### 前端构建

```bash
cd qianduan
npm run build
```

前端构建产物输出到：

```text
qianduan/dist
```

### 后端构建

```bash
go build -o tv-server.exe ./cmd/server
```

### Linux 打包

仓库提供 `build.sh` 用于生成 Linux 部署包。脚本会自动完成以下步骤：

- 编译 Linux 版后端程序
- 复制 `config/config.yaml`
- 复制前端构建产物
- 创建部署脚本 `deploy.sh`
- 生成 Nginx 配置示例
- 将最终产物输出到 `dist/`

使用 `build.sh` 前，请先确保前端已完成构建。

## 配置说明

配置文件位于 `config/` 目录：

- `config/config.example.yaml`：可提交到仓库的示例配置
- `config/config.yaml`：本地或服务器实际运行配置

当前配置项覆盖：

- 服务端口与运行模式
- 允许的跨域来源
- 数据库连接池
- Redis 预留配置
- JWT 与 Cookie 配置
- TradingView 会话与请求策略
- 定时任务调度表达式
- 默认管理员初始化信息

说明：

- Redis 配置已预留，但当前主链路并不依赖 Redis 才能运行
- 系统启动时会根据配置尝试初始化超级管理员账号

## 当前边界

为了帮助后续维护者快速建立正确预期，下面这些属于当前实现的真实边界：

- 系统主链路已能独立运行，但核心业务仍建立在 TradingView 外部接口可用的前提上
- Redis 配置已预留，但当前不是运行必需项
- 自动迁移依赖 GORM 模型定义，适合内部迭代，不适合把它当成严格的数据库变更审计方案
- 前端当前定位为后台控制台，不以公共官网、营销页或多租户 SaaS 首页为目标
- 本仓库更适合内部受控部署，而不是开箱即用的公共云模板

## 开发说明

### 后端

- 启动入口：`cmd/server/main.go`
- 业务代码集中在 `internal/service/`
- API 路由集中在 `internal/router/`
- 模型定义位于 `internal/model/`

### 前端

- 前端项目目录：`qianduan/`
- 路由入口：`qianduan/src/router.tsx`
- 页面按管理端和代理端拆分
- 状态管理使用 React Query 与 Zustand 组合

## FAQ

### 1. 启动项目时必须依赖 Redis 吗

当前不是必须。配置中保留了 Redis 入口，但主运行链路不依赖 Redis 才能启动。

### 2. 系统首次启动会自动初始化管理员吗

会。后端启动时会根据 `config/config.yaml` 中的 `admin` 配置尝试初始化超级管理员账号。

### 3. 前端为什么放在 `qianduan/` 目录

这是当前仓库沿用的项目目录命名。实际职责非常明确，就是独立的 React 管理控制台。

### 4. 这个仓库适合直接公开开源吗

可以公开代码，但更适合作为具备明确业务背景的管理系统基线来使用；如果要面向更广泛的开源受众，建议结合自身场景进一步抽象命名、部署方式和默认配置说明。

### 5. 如果只想跑前端页面可以吗

可以启动前端开发服务器，但大多数业务页面依赖后端 API 和数据库，单独运行前端只能看到有限的静态壳层。

## 文档索引

如果你需要继续扩展功能或理解现有实现，建议按以下顺序阅读：

1. `docs/tv-distribution-system-design.md`
2. `docs/frontend-design.md`
3. `docs/api-reference.md`
4. `docs/mysql-migration-guide.md`
5. `docs/sub-admin-development-guide.md`

## 适用场景

这个项目更适合以下类型的内部业务系统：

- 私有指标或脚本授权管理平台
- 带代理分销链路的账号或订阅管理系统
- 需要后台审核、授权同步和访问审计的一体化业务后台

如果你的目标是纯展示型官网或轻量营销页面，这个仓库不是合适的起点。

## 协作建议

如果你打算基于这个仓库继续迭代，建议遵循以下方式：

- 优先阅读 `docs/tv-distribution-system-design.md`，再进入具体模块开发
- 新增业务能力时先明确角色边界，再补接口和页面
- 涉及配置、口令、Cookie、TradingView 会话的改动时，优先从安全角度审查
- 涉及分销、审核、授权同步链路的改动时，优先验证端到端流程，而不是只看单点接口是否成功
- 涉及公开发布时，优先统一品牌命名、示例数据和部署文档的对外表达

## License

本仓库采用 `Apache-2.0` 许可证，详见 `LICENSE` 文件。
