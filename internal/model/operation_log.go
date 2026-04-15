package model

import "time"

type OperationLog struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	OperatorID uint64    `gorm:"not null;index" json:"operator_id"`
	Action     string    `gorm:"size:50;not null;index" json:"action"`
	TargetType string    `gorm:"size:30" json:"target_type"`
	TargetID   *uint64   `gorm:"index" json:"target_id"`
	Detail     []byte    `gorm:"type:json" json:"detail"`
	IP         string    `gorm:"size:45" json:"ip"`
	CreatedAt  time.Time `json:"created_at"`
}

func (OperationLog) TableName() string {
	return "operation_logs"
}
