package service

import "gorm.io/gorm"

type ScriptScope struct {
	Scoped    bool
	ScriptIDs []uint64
	UserID    uint64
}

func Unrestricted() ScriptScope {
	return ScriptScope{Scoped: false}
}

func RestrictedTo(userID uint64, ids []uint64) ScriptScope {
	return ScriptScope{
		Scoped:    true,
		ScriptIDs: ids,
		UserID:    userID,
	}
}

func (s ScriptScope) ApplyToQuery(query *gorm.DB, scriptIDColumn string) *gorm.DB {
	if !s.Scoped {
		return query
	}
	if len(s.ScriptIDs) == 0 {
		return query.Where("1 = 0")
	}
	return query.Where(scriptIDColumn+" IN ?", s.ScriptIDs)
}

func (s ScriptScope) Allows(scriptID uint64) bool {
	if !s.Scoped {
		return true
	}
	for _, allowed := range s.ScriptIDs {
		if allowed == scriptID {
			return true
		}
	}
	return false
}
