package model

import "time"

type TVAccess struct {
	BaseModel
	ScriptID    uint64     `gorm:"not null;uniqueIndex:idx_script_tv_user" json:"script_id"`
	PineID      string     `gorm:"size:100;not null;index" json:"pine_id"`
	TVUserID    uint64     `gorm:"not null;uniqueIndex:idx_script_tv_user" json:"tv_user_id"`
	Username    string     `gorm:"size:100;not null;index" json:"username"`
	Expiration  *time.Time `json:"expiration"`
	TVCreatedAt time.Time  `json:"tv_created_at"`
	SyncedAt    time.Time  `gorm:"not null;index" json:"synced_at"`
	RemovedAt   *time.Time `gorm:"index" json:"removed_at"`
}

func (TVAccess) TableName() string {
	return "tv_accesses"
}
