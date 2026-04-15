package model

const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
	RoleSubAdmin   = "sub_admin"
	RoleAgent      = "agent"
)

type SystemUser struct {
	BaseModel
	Username       string  `gorm:"size:64;uniqueIndex;not null" json:"username"`
	PasswordHash   string  `gorm:"size:255;not null" json:"-"`
	TokenVersion   int64   `gorm:"not null;default:1" json:"-"`
	Role           string  `gorm:"size:20;not null;index" json:"role"`
	DisplayName    string  `gorm:"size:100" json:"display_name"`
	CommissionRate float64 `gorm:"type:decimal(5,4);default:0" json:"commission_rate"`
	Status         int16   `gorm:"default:1;index" json:"status"`
}

func (SystemUser) TableName() string {
	return "system_users"
}
