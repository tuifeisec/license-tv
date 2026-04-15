package model

import "time"

type Script struct {
	BaseModel
	PineID         string     `gorm:"size:100;uniqueIndex;not null" json:"pine_id"`
	Name           string     `gorm:"size:200;not null" json:"name"`
	Description    string     `gorm:"size:500" json:"description"`
	Kind           string     `gorm:"size:20" json:"kind"`
	Version        string     `gorm:"size:20" json:"version"`
	MonthlyPrice   float64    `gorm:"type:decimal(10,2);default:0" json:"monthly_price"`
	QuarterlyPrice float64    `gorm:"type:decimal(10,2);default:0" json:"quarterly_price"`
	YearlyPrice    float64    `gorm:"type:decimal(10,2);default:0" json:"yearly_price"`
	LifetimePrice  float64    `gorm:"type:decimal(10,2);default:0" json:"lifetime_price"`
	TrialDays      int        `gorm:"default:7" json:"trial_days"`
	Status         int16      `gorm:"default:1;index" json:"status"`
	SyncedAt       *time.Time `json:"synced_at"`
}

func (Script) TableName() string {
	return "scripts"
}
