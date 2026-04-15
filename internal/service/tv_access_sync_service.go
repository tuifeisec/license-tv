package service

import (
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type TVAccessSyncScriptResult struct {
	ScriptID         uint64 `json:"script_id"`
	ScriptName       string `json:"script_name"`
	RemoteCount      int    `json:"remote_count"`
	LocalActiveCount int    `json:"local_active_count"`
	InsertedCount    int    `json:"inserted_count"`
	ReactivatedCount int    `json:"reactivated_count"`
	UpdatedCount     int    `json:"updated_count"`
	UnchangedCount   int    `json:"unchanged_count"`
	RemovedCount     int    `json:"removed_count"`
	Error            string `json:"error,omitempty"`
}

type TVAccessSyncResult struct {
	RanAt            time.Time                  `json:"ran_at"`
	ScriptCount      int                        `json:"script_count"`
	InsertedCount    int                        `json:"inserted_count"`
	ReactivatedCount int                        `json:"reactivated_count"`
	UpdatedCount     int                        `json:"updated_count"`
	UnchangedCount   int                        `json:"unchanged_count"`
	RemovedCount     int                        `json:"removed_count"`
	ErrorCount       int                        `json:"error_count"`
	Scripts          []TVAccessSyncScriptResult `json:"scripts"`
}

type TVAccessSyncService struct {
	db *gorm.DB
	tv TVProxy
}

func NewTVAccessSyncService(db *gorm.DB, tv TVProxy) *TVAccessSyncService {
	return &TVAccessSyncService{db: db, tv: tv}
}

func (s *TVAccessSyncService) SyncAll(operatorID uint64, ip string) (*TVAccessSyncResult, error) {
	var scripts []model.Script
	if err := s.db.Where("status = 1").Order("id DESC").Find(&scripts).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := &TVAccessSyncResult{
		RanAt:       time.Now().UTC(),
		ScriptCount: len(scripts),
		Scripts:     make([]TVAccessSyncScriptResult, 0, len(scripts)),
	}

	for _, script := range scripts {
		item, err := s.syncScript(script)
		if err != nil {
			item.Error = err.Error()
			result.ErrorCount++
		}

		result.InsertedCount += item.InsertedCount
		result.ReactivatedCount += item.ReactivatedCount
		result.UpdatedCount += item.UpdatedCount
		result.UnchangedCount += item.UnchangedCount
		result.RemovedCount += item.RemovedCount
		result.Scripts = append(result.Scripts, item)
	}

	if err := writeOperationLog(s.db, operatorID, "sync_tv_access", "system", nil, result, ip); err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return result, nil
}

func (s *TVAccessSyncService) SyncByScriptID(scriptID uint64, operatorID uint64, ip string) (*TVAccessSyncResult, error) {
	var script model.Script
	if err := s.db.First(&script, scriptID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errcode.ErrTVScriptNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	item, err := s.syncScript(script)
	result := &TVAccessSyncResult{
		RanAt:            time.Now().UTC(),
		ScriptCount:      1,
		InsertedCount:    item.InsertedCount,
		ReactivatedCount: item.ReactivatedCount,
		UpdatedCount:     item.UpdatedCount,
		UnchangedCount:   item.UnchangedCount,
		RemovedCount:     item.RemovedCount,
		Scripts:          []TVAccessSyncScriptResult{item},
	}
	if err != nil {
		item.Error = err.Error()
		result.ErrorCount = 1
		result.Scripts[0] = item
	}

	var targetID *uint64
	targetID = &scriptID
	if logErr := writeOperationLog(s.db, operatorID, "sync_tv_access_by_script", "script", targetID, result, ip); logErr != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, logErr)
	}
	return result, nil
}

func (s *TVAccessSyncService) ListActiveByScriptID(scriptID uint64) ([]model.TVAccess, error) {
	var list []model.TVAccess
	if err := s.db.
		Where("script_id = ? AND removed_at IS NULL", scriptID).
		Order("username ASC").
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return list, nil
}

func (s *TVAccessSyncService) syncScript(script model.Script) (TVAccessSyncScriptResult, error) {
	result := TVAccessSyncScriptResult{
		ScriptID:   script.ID,
		ScriptName: script.Name,
	}

	remoteUsers, err := s.tv.ListAllUsers(script.PineID)
	if err != nil {
		return result, err
	}

	now := time.Now().UTC()
	result.RemoteCount = len(remoteUsers)

	err = s.db.Transaction(func(tx *gorm.DB) error {
		var localRecords []model.TVAccess
		if err := tx.Where("script_id = ?", script.ID).Find(&localRecords).Error; err != nil {
			return errcode.Wrap(errcode.ErrInternal, err)
		}

		localMap := make(map[uint64]model.TVAccess, len(localRecords))
		for _, record := range localRecords {
			localMap[record.TVUserID] = record
			if record.RemovedAt == nil {
				result.LocalActiveCount++
			}
		}

		remoteMap := make(map[uint64]TVUserAccess, len(remoteUsers))
		for _, user := range remoteUsers {
			remoteMap[user.ID] = user
		}

		for _, user := range remoteUsers {
			local, exists := localMap[user.ID]
			if !exists {
				record := model.TVAccess{
					ScriptID:    script.ID,
					PineID:      script.PineID,
					TVUserID:    user.ID,
					Username:    user.Username,
					Expiration:  user.Expiration,
					TVCreatedAt: user.Created.UTC(),
					SyncedAt:    now,
				}
				if err := tx.Create(&record).Error; err != nil {
					return errcode.Wrap(errcode.ErrInternal, err)
				}
				result.InsertedCount++
				continue
			}

			updates := map[string]any{
				"username":      user.Username,
				"pine_id":       script.PineID,
				"synced_at":     now,
				"tv_created_at": user.Created.UTC(),
			}

			stateChanged := false
			if local.RemovedAt != nil {
				updates["removed_at"] = nil
				result.ReactivatedCount++
				stateChanged = true
			}

			if !sameOptionalTime(local.Expiration, user.Expiration) {
				updates["expiration"] = user.Expiration
				result.UpdatedCount++
				stateChanged = true
			}

			if !strings.EqualFold(local.Username, user.Username) {
				stateChanged = true
			}

			if stateChanged {
				if err := tx.Model(&model.TVAccess{}).
					Where("id = ?", local.ID).
					Updates(updates).Error; err != nil {
					return errcode.Wrap(errcode.ErrInternal, err)
				}
				if local.RemovedAt == nil && sameOptionalTime(local.Expiration, user.Expiration) && strings.EqualFold(local.Username, user.Username) {
					result.UnchangedCount++
				}
				continue
			}

			if err := tx.Model(&model.TVAccess{}).
				Where("id = ?", local.ID).
				Update("synced_at", now).Error; err != nil {
				return errcode.Wrap(errcode.ErrInternal, err)
			}
			result.UnchangedCount++
		}

		for _, local := range localRecords {
			if local.RemovedAt != nil {
				continue
			}
			if _, ok := remoteMap[local.TVUserID]; ok {
				continue
			}
			if err := tx.Model(&model.TVAccess{}).
				Where("id = ?", local.ID).
				Update("removed_at", now).Error; err != nil {
				return errcode.Wrap(errcode.ErrInternal, err)
			}
			result.RemovedCount++
		}

		return nil
	})
	return result, err
}

func sameOptionalTime(left, right *time.Time) bool {
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}
	return left.UTC().Equal(right.UTC())
}

func sortTVAccesses(list []model.TVAccess) {
	sort.Slice(list, func(i, j int) bool {
		if strings.ToLower(list[i].Username) != strings.ToLower(list[j].Username) {
			return strings.ToLower(list[i].Username) < strings.ToLower(list[j].Username)
		}
		return list[i].TVUserID < list[j].TVUserID
	})
}
