package model

import "time"

type BaseModel struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func AllModels() []any {
	return []any{
		&SystemUser{},
		&SystemSetting{},
		&Script{},
		&UserScriptPermission{},
		&TVAccess{},
		&Customer{},
		&AccessRequest{},
		&Subscription{},
		&OperationLog{},
	}
}
