package model

import "time"

const (
	SubscriptionStatusActive  = "active"
	SubscriptionStatusExpired = "expired"
	SubscriptionStatusRevoked = "revoked"
)

const (
	PlanMonthly   = "monthly"
	PlanQuarterly = "quarterly"
	PlanYearly    = "yearly"
	PlanLifetime  = "lifetime"
	PlanTrial     = "trial"
)

type Subscription struct {
	BaseModel
	CustomerID    uint64     `gorm:"not null;index" json:"customer_id"`
	ScriptID      uint64     `gorm:"not null;index" json:"script_id"`
	PlanType      string     `gorm:"size:20;not null" json:"plan_type"`
	Status        string     `gorm:"size:20;not null;index" json:"status"`
	TVGranted     bool       `gorm:"default:false" json:"tv_granted"`
	StartedAt     time.Time  `json:"started_at"`
	ExpiresAt     *time.Time `json:"expires_at"`
	LastRequestID *uint64    `gorm:"index" json:"last_request_id"`
	GrantedBy     *uint64    `gorm:"index" json:"granted_by"`
	RevokedAt     *time.Time `json:"revoked_at"`
	RevokedBy     *uint64    `gorm:"index" json:"revoked_by"`

	Customer Customer `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Script   Script   `gorm:"foreignKey:ScriptID" json:"script,omitempty"`
}

func (Subscription) TableName() string {
	return "subscriptions"
}
