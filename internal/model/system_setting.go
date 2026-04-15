package model

type SystemSetting struct {
	BaseModel
	SettingKey   string `gorm:"size:100;uniqueIndex;not null" json:"setting_key"`
	SettingValue string `gorm:"type:longtext;not null" json:"setting_value"`
	Description  string `gorm:"size:255" json:"description"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}
