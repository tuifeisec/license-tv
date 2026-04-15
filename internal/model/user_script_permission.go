package model

type UserScriptPermission struct {
	BaseModel
	UserID   uint64 `gorm:"not null;uniqueIndex:uk_user_script" json:"user_id"`
	ScriptID uint64 `gorm:"not null;uniqueIndex:uk_user_script" json:"script_id"`

	User   SystemUser `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Script Script     `gorm:"foreignKey:ScriptID" json:"script,omitempty"`
}

func (UserScriptPermission) TableName() string {
	return "user_script_permissions"
}
