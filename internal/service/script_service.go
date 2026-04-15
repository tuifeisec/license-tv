package service

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type UpdateScriptDTO struct {
	Name           *string  `json:"name"`
	Description    *string  `json:"description"`
	MonthlyPrice   *float64 `json:"monthly_price"`
	QuarterlyPrice *float64 `json:"quarterly_price"`
	YearlyPrice    *float64 `json:"yearly_price"`
	LifetimePrice  *float64 `json:"lifetime_price"`
	TrialDays      *int     `json:"trial_days"`
	Status         *int16   `json:"status"`
}

type ScriptListFilter struct {
	ListFilter
	Status string `form:"status"`
}

func (f *ScriptListFilter) Normalize() {
	f.ListFilter.Normalize()
	f.Status = strings.TrimSpace(strings.ToLower(f.Status))
}

type ScriptService struct {
	db *gorm.DB
	tv TVProxy
}

func NewScriptService(db *gorm.DB, tv TVProxy) *ScriptService {
	return &ScriptService{db: db, tv: tv}
}

func (s *ScriptService) SyncScripts() (int, error) {
	pineIDs, err := s.tv.ListScripts()
	if err != nil {
		return 0, err
	}
	details, err := s.tv.GetPublishedScriptsDetail()
	if err != nil {
		return 0, err
	}

	detailMap := make(map[string]TVScriptDetail, len(details))
	for _, item := range details {
		detailMap[item.ScriptIDPart] = item
	}

	now := time.Now().UTC()
	count := 0
	for _, pineID := range pineIDs {
		if !strings.HasPrefix(pineID, "PUB;") {
			continue
		}
		detail := detailMap[pineID]
		record := model.Script{
			PineID:      pineID,
			Name:        detail.ScriptName,
			Description: detail.Extra.ShortDescription,
			Kind:        detail.Extra.Kind,
			Version:     detail.Version,
			SyncedAt:    &now,
			Status:      1,
		}

		if err := s.db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "pine_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"name", "description", "kind", "version", "synced_at",
			}),
		}).Create(&record).Error; err != nil {
			return count, errcode.Wrap(errcode.ErrInternal, err)
		}
		count++
	}
	return count, nil
}

func (s *ScriptService) List(filter ScriptListFilter, activeOnly bool, scope ScriptScope) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.Script{})
	query = scope.ApplyToQuery(query, "id")
	if activeOnly {
		query = query.Where("status = 1")
	} else {
		switch filter.Status {
		case "enabled":
			query = query.Where("status = 1")
		case "disabled":
			query = query.Where("status <> 1")
		}
	}
	if filter.Keyword != "" {
		query = query.Where("name LIKE ? OR pine_id LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.Script
	if err := query.Order("id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &PageResult{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *ScriptService) GetByID(id uint64, scope ScriptScope) (*model.Script, error) {
	var item model.Script
	query := s.db.Model(&model.Script{}).Where("id = ?", id)
	query = scope.ApplyToQuery(query, "id")
	if err := query.First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrTVScriptNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &item, nil
}

func (s *ScriptService) Update(id uint64, dto UpdateScriptDTO, scope ScriptScope) (*model.Script, error) {
	item, err := s.GetByID(id, scope)
	if err != nil {
		return nil, err
	}

	updates := map[string]any{}
	if dto.Name != nil {
		updates["name"] = *dto.Name
	}
	if dto.Description != nil {
		updates["description"] = *dto.Description
	}
	if dto.MonthlyPrice != nil {
		updates["monthly_price"] = *dto.MonthlyPrice
	}
	if dto.QuarterlyPrice != nil {
		updates["quarterly_price"] = *dto.QuarterlyPrice
	}
	if dto.YearlyPrice != nil {
		updates["yearly_price"] = *dto.YearlyPrice
	}
	if dto.LifetimePrice != nil {
		updates["lifetime_price"] = *dto.LifetimePrice
	}
	if dto.TrialDays != nil {
		updates["trial_days"] = *dto.TrialDays
	}
	if dto.Status != nil {
		updates["status"] = *dto.Status
	}

	if len(updates) > 0 {
		if err := s.db.Model(item).Updates(updates).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}
	}
	return s.GetByID(id, scope)
}

func (s *ScriptService) ListAuthorizedUsers(id uint64) ([]TVUserAccess, error) {
	item, err := s.GetByID(id, Unrestricted())
	if err != nil {
		return nil, err
	}
	return s.tv.ListAllUsers(item.PineID)
}
