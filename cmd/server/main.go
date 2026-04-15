package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"tv-distribution/internal/config"
	"tv-distribution/internal/model"
	"tv-distribution/internal/router"
	"tv-distribution/internal/scheduler"
	"tv-distribution/internal/service"
)

func main() {
	cfg, err := config.Load("config/config.yaml")
	if err != nil {
		panic(err)
	}

	loggerCfg := zap.NewProductionConfig()
	if err := loggerCfg.Level.UnmarshalText([]byte(cfg.Server.LogLevel)); err != nil {
		loggerCfg.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	}

	logger, err := loggerCfg.Build()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	if cfg.Server.Mode != "" {
		gin.SetMode(cfg.Server.Mode)
	}

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		logger.Fatal("failed to connect database", zap.Error(err))
	}

	sqlDB, err := db.DB()
	if err != nil {
		logger.Fatal("failed to get sql db handle", zap.Error(err))
	}
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.Database.MaxLifetime())
	sqlDB.SetConnMaxIdleTime(cfg.Database.MaxIdleTime())
	defer sqlDB.Close()

	if err := db.AutoMigrate(model.AllModels()...); err != nil {
		logger.Fatal("failed to migrate models", zap.Error(err))
	}

	tvProxy := service.NewTradingViewProxy(&cfg.TradingView)
	settingsService := service.NewSystemSettingService(db, cfg)
	tvSessionService := service.NewTVSessionService(tvProxy, settingsService)
	if err := tvSessionService.LoadPersistedCookies(); err != nil {
		logger.Warn("failed to load persisted tv cookies", zap.Error(err))
	}
	authService := service.NewAuthService(db, cfg)
	if cfg.Admin.Username != "" && cfg.Admin.Password != "" {
		if err := authService.EnsureSuperAdmin(cfg.Admin.Username, cfg.Admin.Password, cfg.Admin.DisplayName); err != nil {
			logger.Fatal("failed to initialize super admin", zap.Error(err))
		}
	}
	customerService := service.NewCustomerService(db, tvProxy)
	scriptService := service.NewScriptService(db, tvProxy)
	reviewService := service.NewReviewService(db, tvProxy, customerService, logger)
	subscriptionService := service.NewSubscriptionService(db, tvProxy, customerService, logger)
	tvAccessSyncService := service.NewTVAccessSyncService(db, tvProxy)
	accessAuditService := service.NewAccessAuditService(db)
	tvAccessOverviewService := service.NewTVAccessOverviewService(db)
	paymentProofService := service.NewPaymentProofService(db, logger)

	sched, err := scheduler.New(
		cfg,
		logger,
		tvProxy,
		scriptService,
		tvAccessSyncService,
		subscriptionService,
		accessAuditService,
		paymentProofService,
	)
	if err != nil {
		logger.Fatal("failed to initialize scheduler", zap.Error(err))
	}
	sched.Start()
	defer sched.Stop()

	engine := router.NewEngine(router.Services{
		DB:             db,
		Auth:           authService,
		TV:             tvProxy,
		TVSession:      tvSessionService,
		AccessAudit:    accessAuditService,
		TVAccessSync:   tvAccessSyncService,
		TVAccessView:   tvAccessOverviewService,
		Scripts:        scriptService,
		Customers:      customerService,
		Reviews:        reviewService,
		Subscriptions:  subscriptionService,
		AllowedOrigins: cfg.Server.AllowedOrigins,
	}, logger)

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.Info("server started", zap.String("addr", addr))
	if err := engine.Run(addr); err != nil {
		logger.Fatal("server stopped", zap.Error(err))
	}
}
