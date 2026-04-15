package service

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"tv-distribution/internal/model"
)

const paymentProofCleanupRoot = "uploads/payment-proofs"

type PaymentProofCleanupResult struct {
	ScannedCount int
	RemovedCount int
	KeptCount    int
}

type PaymentProofService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewPaymentProofService(db *gorm.DB, logger *zap.Logger) *PaymentProofService {
	return &PaymentProofService{db: db, logger: logger}
}

func (s *PaymentProofService) CleanupOrphans(maxAge time.Duration) (*PaymentProofCleanupResult, error) {
	result := &PaymentProofCleanupResult{}

	entries, err := os.ReadDir(paymentProofCleanupRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return nil, err
	}

	var referenced []string
	if err := s.db.Model(&model.AccessRequest{}).
		Where("payment_proof <> ''").
		Distinct().
		Pluck("payment_proof", &referenced).Error; err != nil {
		return nil, err
	}

	referencedSet := make(map[string]struct{}, len(referenced))
	for _, item := range referenced {
		referencedSet[normalizeProofPath(item)] = struct{}{}
	}

	now := time.Now().UTC()
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		result.ScannedCount++

		fullPath := filepath.Join(paymentProofCleanupRoot, entry.Name())
		normalizedPath := normalizeProofPath("/" + filepath.ToSlash(fullPath))
		if _, ok := referencedSet[normalizedPath]; ok {
			result.KeptCount++
			continue
		}

		info, err := entry.Info()
		if err != nil {
			s.logger.Warn("payment proof stat failed", zap.String("path", fullPath), zap.Error(err))
			result.KeptCount++
			continue
		}

		if now.Sub(info.ModTime().UTC()) < maxAge {
			result.KeptCount++
			continue
		}

		if err := os.Remove(fullPath); err != nil {
			s.logger.Warn("payment proof cleanup failed", zap.String("path", fullPath), zap.Error(err))
			result.KeptCount++
			continue
		}

		result.RemovedCount++
	}

	return result, nil
}

func normalizeProofPath(value string) string {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), "\\", "/")
	if normalized == "" {
		return ""
	}
	if !strings.HasPrefix(normalized, "/") {
		normalized = "/" + normalized
	}
	return normalized
}
