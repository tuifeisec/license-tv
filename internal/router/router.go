package router

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	rootHandler "tv-distribution/internal/handler"
	adminHandler "tv-distribution/internal/handler/admin"
	agentHandler "tv-distribution/internal/handler/agent"
	"tv-distribution/internal/middleware"
	"tv-distribution/internal/model"
	"tv-distribution/internal/service"
)

type Services struct {
	DB             *gorm.DB
	Auth           *service.AuthService
	TV             service.TVProxy
	TVSession      *service.TVSessionService
	AccessAudit    *service.AccessAuditService
	TVAccessSync   *service.TVAccessSyncService
	TVAccessView   *service.TVAccessOverviewService
	Scripts        *service.ScriptService
	Customers      *service.CustomerService
	Reviews        *service.ReviewService
	Subscriptions  *service.SubscriptionService
	AllowedOrigins []string
}

func NewEngine(services Services, logger *zap.Logger) *gin.Engine {
	engine := gin.New()
	engine.Use(middleware.Recovery(logger))
	engine.Use(middleware.CORS(services.AllowedOrigins))
	engine.Use(middleware.InjectClientIP())
	engine.Static("/uploads", "./uploads")

	healthH := rootHandler.NewHealthHandler(services.DB, services.TV)
	engine.GET("/health", healthH.Check)

	registerAdminRoutes(engine, services)
	registerAgentRoutes(engine, services)

	return engine
}

func registerAdminRoutes(engine *gin.Engine, services Services) {
	var (
		authH         = adminHandler.NewAuthHandler(services.Auth)
		scriptH       = adminHandler.NewScriptHandler(services.Scripts)
		customerH     = adminHandler.NewCustomerHandler(services.Customers)
		reviewH       = adminHandler.NewReviewHandler(services.Reviews)
		subH          = adminHandler.NewSubscriptionHandler(services.Subscriptions)
		agentMgmtH    = adminHandler.NewAgentMgmtHandler(services.Auth)
		subAdminMgmtH = adminHandler.NewSubAdminMgmtHandler(services.Auth)
		tvH           = adminHandler.NewTVSessionHandler(
			services.DB,
			services.TVSession,
			services.AccessAudit,
			services.TVAccessView,
			services.TVAccessSync,
		)
		dashboardH = adminHandler.NewDashboardHandler(services.DB)
	)

	base := engine.Group("/api/admin/v1")
	base.Use(middleware.RateLimit(120, time.Minute))
	base.POST("/auth/login", authH.Login)
	base.POST("/auth/refresh", authH.Refresh)
	base.POST("/auth/logout", authH.Logout)

	protected := base.Group("")
	protected.Use(middleware.JWTAuth(services.Auth))
	protected.Use(middleware.RequireRoles(model.RoleAdmin, model.RoleSubAdmin, model.RoleSuperAdmin))
	protected.Use(middleware.InjectScriptScope(services.DB))
	protected.GET("/auth/profile", authH.Profile)
	protected.PUT("/auth/profile", authH.UpdateProfile)
	protected.PUT("/auth/password", authH.ChangePassword)

	protected.GET("/scripts", scriptH.List)
	protected.GET("/scripts/:id", scriptH.Get)
	protected.PUT("/scripts/:id", scriptH.Update)

	protected.GET("/reviews", reviewH.List)
	protected.GET("/reviews/:id", reviewH.Get)
	protected.POST("/reviews/:id/approve", reviewH.Approve)
	protected.POST("/reviews/:id/reject", reviewH.Reject)
	protected.POST("/reviews/batch-approve", reviewH.BatchApprove)

	protected.GET("/subscriptions", subH.List)
	protected.POST("/subscriptions", subH.Create)
	protected.POST("/subscriptions/:id/renew", subH.Renew)
	protected.POST("/subscriptions/:id/revoke", subH.Revoke)
	protected.GET("/subscriptions/:id", subH.Get)

	protected.GET("/customers", customerH.List)
	protected.POST("/customers", customerH.Create)
	protected.GET("/customers/:id", customerH.Get)
	protected.PUT("/customers/:id", customerH.Update)
	protected.GET("/tv/validate-username", customerH.ValidateTVUsername)

	protected.GET("/dashboard/stats", dashboardH.Stats)
	protected.GET("/agents", agentMgmtH.List)
	protected.POST("/agents", agentMgmtH.Create)
	protected.PUT("/agents/:id", agentMgmtH.Update)
	protected.POST("/agents/:id/reset-password", agentMgmtH.ResetPassword)
	protected.GET("/agents/:id", agentMgmtH.Get)

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

	subAdminMgmt := protected.Group("")
	subAdminMgmt.Use(middleware.RequireRoles(model.RoleAdmin, model.RoleSuperAdmin))
	subAdminMgmt.GET("/sub-admins", subAdminMgmtH.List)
	subAdminMgmt.POST("/sub-admins", subAdminMgmtH.Create)
	subAdminMgmt.GET("/sub-admins/:id", subAdminMgmtH.Get)
	subAdminMgmt.PUT("/sub-admins/:id", subAdminMgmtH.Update)
	subAdminMgmt.POST("/sub-admins/:id/reset-password", subAdminMgmtH.ResetPassword)
	subAdminMgmt.PUT("/sub-admins/:id/scripts", subAdminMgmtH.UpdateScripts)
}

func registerAgentRoutes(engine *gin.Engine, services Services) {
	authH := agentHandler.NewAuthHandler(services.Auth)
	requestH := agentHandler.NewRequestHandler(services.Reviews)
	customerH := agentHandler.NewCustomerHandler(services.Customers)
	statsH := agentHandler.NewStatsHandler(services.DB, services.Scripts, services.Customers)

	base := engine.Group("/api/agent/v1")
	base.Use(middleware.RateLimit(60, time.Minute))
	base.POST("/auth/login", authH.Login)
	base.POST("/auth/refresh", authH.Refresh)
	base.POST("/auth/logout", authH.Logout)

	protected := base.Group("")
	protected.Use(middleware.JWTAuth(services.Auth))
	protected.Use(middleware.RequireRoles(model.RoleAgent))
	protected.GET("/auth/profile", authH.Profile)
	protected.PUT("/auth/profile", authH.UpdateProfile)
	protected.PUT("/auth/password", authH.ChangePassword)

	protected.POST("/requests", requestH.Create)
	protected.POST("/uploads/payment-proof", requestH.UploadPaymentProof)
	protected.GET("/requests", requestH.List)
	protected.GET("/requests/:id", requestH.Get)
	protected.POST("/requests/:id/cancel", requestH.Cancel)

	protected.GET("/customers", customerH.List)
	protected.POST("/customers", customerH.Create)
	protected.GET("/customers/:id", customerH.Get)
	protected.PUT("/customers/:id", customerH.Update)

	protected.GET("/scripts", statsH.ListScripts)
	protected.GET("/tv/validate-username", statsH.ValidateTVUsername)
	protected.GET("/stats", statsH.Stats)
}
