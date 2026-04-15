package model

type Customer struct {
	BaseModel
	TVUsername string  `gorm:"size:100;uniqueIndex;not null" json:"tv_username"`
	TVUserID   *uint64 `json:"tv_user_id"`
	Contact    string  `gorm:"size:200" json:"contact"`
	Remark     string  `gorm:"type:text" json:"remark"`
	AgentID    *uint64 `gorm:"index" json:"agent_id"`
	CreatedBy  *uint64 `gorm:"index" json:"created_by"`
}

func (Customer) TableName() string {
	return "customers"
}
