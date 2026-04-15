package scheduler

import (
	"time"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"tv-distribution/internal/config"
	"tv-distribution/internal/service"
)

type Scheduler struct {
	cron *cron.Cron
}

func New(
	cfg *config.Config,
	logger *zap.Logger,
	tv service.TVProxy,
	scripts *service.ScriptService,
	tvAccessSync *service.TVAccessSyncService,
	subs *service.SubscriptionService,
	audit *service.AccessAuditService,
	paymentProofs *service.PaymentProofService,
) (*Scheduler, error) {
	c := cron.New()

	if _, err := c.AddFunc(cfg.Scheduler.CookieCheck, func() {
		if _, err := tv.ValidateSession(); err != nil {
			logger.Warn("cookie health check failed", zap.Error(err))
		}
	}); err != nil {
		return nil, err
	}

	if _, err := c.AddFunc(cfg.Scheduler.ExpireScan, func() {
		count, err := subs.RevokeExpired()
		if err != nil {
			logger.Warn("expire scan failed", zap.Error(err))
			return
		}
		logger.Info("expire scan finished", zap.Int("revoked_count", count))
	}); err != nil {
		return nil, err
	}

	if _, err := c.AddFunc(cfg.Scheduler.ScriptSync, func() {
		count, err := scripts.SyncScripts()
		if err != nil {
			logger.Warn("script sync failed", zap.Error(err))
			return
		}
		logger.Info("script sync finished", zap.Int("synced_count", count))
	}); err != nil {
		return nil, err
	}

	if _, err := c.AddFunc(cfg.Scheduler.TVAccessSync, func() {
		result, err := tvAccessSync.SyncAll(0, "scheduler")
		if err != nil {
			logger.Warn("tv access sync failed", zap.Error(err))
			return
		}
		logger.Info("tv access sync finished",
			zap.Int("script_count", result.ScriptCount),
			zap.Int("inserted_count", result.InsertedCount),
			zap.Int("reactivated_count", result.ReactivatedCount),
			zap.Int("updated_count", result.UpdatedCount),
			zap.Int("removed_count", result.RemovedCount),
			zap.Int("error_count", result.ErrorCount),
		)
	}); err != nil {
		return nil, err
	}

	if _, err := c.AddFunc(cfg.Scheduler.AccessAudit, func() {
		result, err := audit.Run(0, "scheduler")
		if err != nil {
			logger.Warn("access audit failed", zap.Error(err))
			return
		}
		logger.Info("access audit finished",
			zap.Int("script_count", result.ScriptCount),
			zap.Int("mismatch_count", result.MismatchCount),
			zap.Int("error_count", result.ErrorCount),
		)
	}); err != nil {
		return nil, err
	}

	if _, err := c.AddFunc(cfg.Scheduler.PaymentProofCleanup, func() {
		result, err := paymentProofs.CleanupOrphans(24 * time.Hour)
		if err != nil {
			logger.Warn("payment proof cleanup failed", zap.Error(err))
			return
		}
		logger.Info("payment proof cleanup finished",
			zap.Int("scanned_count", result.ScannedCount),
			zap.Int("removed_count", result.RemovedCount),
			zap.Int("kept_count", result.KeptCount),
		)
	}); err != nil {
		return nil, err
	}

	return &Scheduler{cron: c}, nil
}

func (s *Scheduler) Start() {
	s.cron.Start()
}

func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
}
