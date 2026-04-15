package model

import "time"

const (
	RequestActionNew    = "new"
	RequestActionRenew  = "renew"
	RequestActionModify = "modify"

	RequestStatusPending   = "pending"
	RequestStatusApproved  = "approved"
	RequestStatusRejected  = "rejected"
	RequestStatusCancelled = "cancelled"
)

type AccessRequest struct {
	BaseModel
	RequestNo     string     `gorm:"size:32;uniqueIndex;not null" json:"request_no"`
	AgentID       uint64     `gorm:"not null;index" json:"agent_id"`
	CustomerID    uint64     `gorm:"not null;index" json:"customer_id"`
	ScriptID      uint64     `gorm:"not null;index" json:"script_id"`
	Action        string     `gorm:"size:20;not null" json:"action"`
	PlanType      string     `gorm:"size:20;not null" json:"plan_type"`
	RequestedDays int        `json:"requested_days"`
	Amount        float64    `gorm:"type:decimal(10,2);default:0" json:"amount"`
	PaymentProof  string     `gorm:"size:500" json:"payment_proof"`
	Status        string     `gorm:"size:20;not null;default:'pending';index" json:"status"`
	ReviewedBy    *uint64    `gorm:"index" json:"reviewed_by"`
	ReviewedAt    *time.Time `json:"reviewed_at"`
	RejectReason  string     `gorm:"size:500" json:"reject_reason"`
	Remark        string     `gorm:"type:text" json:"remark"`

	Agent    SystemUser `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Customer Customer   `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Script   Script     `gorm:"foreignKey:ScriptID" json:"script,omitempty"`
}

func (AccessRequest) TableName() string {
	return "access_requests"
}
