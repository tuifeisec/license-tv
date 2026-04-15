package service

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"tv-distribution/internal/config"
	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

type TokenClaims struct {
	UserID       uint64 `json:"user_id"`
	Username     string `json:"username"`
	Role         string `json:"role"`
	TokenType    string `json:"token_type"`
	TokenVersion int64  `json:"token_version"`
	jwt.RegisteredClaims
}

type UserProfile struct {
	ID             uint64  `json:"id"`
	Username       string  `json:"username"`
	Role           string  `json:"role"`
	DisplayName    string  `json:"display_name"`
	CommissionRate float64 `json:"commission_rate"`
	Status         int16   `json:"status"`
}

type TokenPair struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         UserProfile `json:"user"`
}

type LoginDTO struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RefreshTokenDTO struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ChangePasswordDTO struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type ChangePasswordResult struct {
	Updated                  bool       `json:"updated"`
	Session                  *TokenPair `json:"session,omitempty"`
	OtherSessionsInvalidated bool       `json:"other_sessions_invalidated"`
}

type UpdateProfileDTO struct {
	DisplayName string `json:"display_name" binding:"required"`
}

type CreateAgentDTO struct {
	Username       string  `json:"username" binding:"required"`
	Password       string  `json:"password" binding:"required,min=6"`
	DisplayName    string  `json:"display_name"`
	CommissionRate float64 `json:"commission_rate"`
	Status         *int16  `json:"status"`
}

type UpdateAgentDTO struct {
	DisplayName    *string  `json:"display_name"`
	CommissionRate *float64 `json:"commission_rate"`
	Status         *int16   `json:"status"`
}

type ResetAgentPasswordDTO struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type CreateSubAdminDTO struct {
	Username    string   `json:"username" binding:"required"`
	Password    string   `json:"password" binding:"required,min=6"`
	DisplayName string   `json:"display_name"`
	Status      *int16   `json:"status"`
	ScriptIDs   []uint64 `json:"script_ids"`
}

type UpdateSubAdminDTO struct {
	DisplayName *string `json:"display_name"`
	Status      *int16  `json:"status"`
}

type UpdateSubAdminScriptsDTO struct {
	ScriptIDs []uint64 `json:"script_ids"`
}

type AgentDetailDTO struct {
	ID                      uint64    `json:"id"`
	Username                string    `json:"username"`
	DisplayName             string    `json:"display_name"`
	Role                    string    `json:"role"`
	CommissionRate          float64   `json:"commission_rate"`
	Status                  int16     `json:"status"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
	CustomerCount           int64     `json:"customer_count"`
	ActiveSubscriptionCount int64     `json:"active_subscription_count"`
	ApprovedAmountTotal     float64   `json:"approved_amount_total"`
}

type SubAdminDetailDTO struct {
	ID          uint64         `json:"id"`
	Username    string         `json:"username"`
	DisplayName string         `json:"display_name"`
	Role        string         `json:"role"`
	Status      int16          `json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	Scripts     []model.Script `json:"scripts"`
}

type CurrentProfileDTO struct {
	ID             uint64    `json:"id"`
	Username       string    `json:"username"`
	Role           string    `json:"role"`
	DisplayName    string    `json:"display_name"`
	CommissionRate float64   `json:"commission_rate"`
	Status         int16     `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func (s *AuthService) LoginAdmin(dto LoginDTO) (*TokenPair, error) {
	return s.loginWithRoles(dto, model.RoleAdmin, model.RoleSubAdmin, model.RoleSuperAdmin)
}

func (s *AuthService) LoginAgent(dto LoginDTO) (*TokenPair, error) {
	return s.loginWithRoles(dto, model.RoleAgent)
}

func (s *AuthService) EnsureSuperAdmin(username, password, displayName string) error {
	var count int64
	if err := s.db.Model(&model.SystemUser{}).
		Where("username = ? AND role = ?", username, model.RoleSuperAdmin).
		Count(&count).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	user := model.SystemUser{
		Username:     username,
		PasswordHash: string(hash),
		TokenVersion: 1,
		Role:         model.RoleSuperAdmin,
		DisplayName:  displayName,
		Status:       1,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return nil
}

func (s *AuthService) Refresh(refreshToken string) (*TokenPair, error) {
	claims, err := s.parseToken(refreshToken)
	if err != nil || claims.TokenType != "refresh" {
		return nil, errcode.Wrap(errcode.ErrTokenExpired, err)
	}

	user, err := s.GetUserByID(claims.UserID)
	if err != nil {
		return nil, err
	}
	return s.issueTokenPair(user)
}

func (s *AuthService) AccessTokenTTL(role string) time.Duration {
	accessHours := s.cfg.JWT.AgentExpireHours
	if role == model.RoleAdmin || role == model.RoleSubAdmin || role == model.RoleSuperAdmin {
		accessHours = s.cfg.JWT.AdminExpireHours
	}
	return time.Duration(accessHours) * time.Hour
}

func (s *AuthService) RefreshTokenTTL() time.Duration {
	return time.Duration(s.cfg.JWT.RefreshHours) * time.Hour
}

func (s *AuthService) CookieDomain() string {
	return s.cfg.JWT.CookieDomain
}

func (s *AuthService) CookieSecure() bool {
	return s.cfg.JWT.CookieSecure
}

func (s *AuthService) CookieSameSite() http.SameSite {
	switch strings.ToLower(strings.TrimSpace(s.cfg.JWT.CookieSameSite)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func (s *AuthService) GetCurrentProfile(userID uint64) (*CurrentProfileDTO, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	return toCurrentProfile(user), nil
}

func (s *AuthService) UpdateCurrentProfile(userID uint64, dto UpdateProfileDTO, ip string) (*CurrentProfileDTO, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	displayName := strings.TrimSpace(dto.DisplayName)
	if err := validateDisplayName(displayName); err != nil {
		return nil, err
	}

	if displayName == user.DisplayName {
		return toCurrentProfile(user), nil
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
	}

	if err := tx.Model(&model.SystemUser{}).
		Where("id = ?", userID).
		Update("display_name", displayName).Error; err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	targetID := userID
	if err := writeOperationLog(tx, userID, "update_profile", "system_user", &targetID, map[string]any{
		"summary":      buildUpdateProfileSummary(displayName),
		"before_name":  user.DisplayName,
		"display_name": displayName,
	}, ip); err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	updatedUser, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	return toCurrentProfile(updatedUser), nil
}

func (s *AuthService) ChangePassword(userID uint64, dto ChangePasswordDTO, ip string) (*ChangePasswordResult, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(dto.OldPassword)) != nil {
		return nil, errcode.ErrInvalidCredentials
	}
	if dto.OldPassword == dto.NewPassword {
		return nil, errcode.ErrValidation
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(dto.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
	}

	otherSessionsInvalidated := user.Role == model.RoleSuperAdmin
	newTokenVersion := normalizedTokenVersion(user.TokenVersion)
	if otherSessionsInvalidated {
		newTokenVersion++
	}

	if err := tx.Model(&model.SystemUser{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"password_hash": string(hash),
			"token_version": newTokenVersion,
		}).Error; err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	targetID := userID
	if err := writeOperationLog(tx, userID, "change_password", "system_user", &targetID, map[string]any{
		"summary":                    buildChangePasswordAuditSummary(user.Role, otherSessionsInvalidated),
		"role":                       user.Role,
		"other_sessions_invalidated": otherSessionsInvalidated,
	}, ip); err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	updatedUser, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}
	session, err := s.issueTokenPair(updatedUser)
	if err != nil {
		return nil, err
	}

	return &ChangePasswordResult{
		Updated:                  true,
		Session:                  session,
		OtherSessionsInvalidated: otherSessionsInvalidated,
	}, nil
}

func (s *AuthService) ParseAccessToken(token string) (*TokenClaims, error) {
	claims, err := s.parseToken(token)
	if err != nil || claims.TokenType != "access" {
		return nil, errcode.Wrap(errcode.ErrTokenExpired, err)
	}
	return claims, nil
}

func (s *AuthService) GetUserByID(id uint64) (*model.SystemUser, error) {
	var user model.SystemUser
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrUnauthorized
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if user.Status == 0 {
		return nil, errcode.ErrAccountDisabled
	}
	return &user, nil
}

func (s *AuthService) ListAgents(filter AgentListFilter) (*PageResult, error) {
	filter.Normalize()

	var total int64
	baseQuery := s.db.Model(&model.SystemUser{}).Where("role = ?", model.RoleAgent)
	if filter.Keyword != "" {
		baseQuery = baseQuery.Where("username LIKE ? OR display_name LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
	}
	if filter.Status != "" {
		status, err := parseAgentStatusFilter(filter.Status)
		if err != nil {
			return nil, err
		}
		baseQuery = baseQuery.Where("status = ?", status)
	}
	switch filter.Performance {
	case "", "all":
	case "with_customers":
		baseQuery = baseQuery.Where("EXISTS (SELECT 1 FROM customers WHERE customers.agent_id = system_users.id)")
	case "with_active_subscriptions":
		baseQuery = baseQuery.Where(
			`EXISTS (
				SELECT 1
				FROM customers
				INNER JOIN subscriptions ON subscriptions.customer_id = customers.id
				WHERE customers.agent_id = system_users.id AND subscriptions.status = ?
			)`,
			model.SubscriptionStatusActive,
		)
	case "with_approved_requests":
		baseQuery = baseQuery.Where(
			"EXISTS (SELECT 1 FROM access_requests WHERE access_requests.agent_id = system_users.id AND access_requests.status = ?)",
			model.RequestStatusApproved,
		)
	default:
		return nil, errcode.ErrValidation
	}
	if err := baseQuery.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	orderClause, err := buildAgentSortClause(filter.SortBy, filter.SortOrder)
	if err != nil {
		return nil, err
	}

	customerStatsSubQuery := s.db.Model(&model.Customer{}).
		Select("agent_id, COUNT(*) AS customer_count").
		Group("agent_id")
	activeSubscriptionStatsSubQuery := s.db.Model(&model.Subscription{}).
		Select("customers.agent_id AS agent_id, COUNT(*) AS active_subscription_count").
		Joins("JOIN customers ON customers.id = subscriptions.customer_id").
		Where("subscriptions.status = ?", model.SubscriptionStatusActive).
		Group("customers.agent_id")
	approvedAmountStatsSubQuery := s.db.Model(&model.AccessRequest{}).
		Select("agent_id, COALESCE(SUM(amount), 0) AS approved_amount_total").
		Where("status = ?", model.RequestStatusApproved).
		Group("agent_id")

	type agentListRow struct {
		model.SystemUser
		CustomerCount           int64   `gorm:"column:customer_count"`
		ActiveSubscriptionCount int64   `gorm:"column:active_subscription_count"`
		ApprovedAmountTotal     float64 `gorm:"column:approved_amount_total"`
	}

	var list []agentListRow
	if err := baseQuery.Session(&gorm.Session{}).
		Select(`
			system_users.*,
			COALESCE(customer_stats.customer_count, 0) AS customer_count,
			COALESCE(subscription_stats.active_subscription_count, 0) AS active_subscription_count,
			COALESCE(amount_stats.approved_amount_total, 0) AS approved_amount_total
		`).
		Joins("LEFT JOIN (?) AS customer_stats ON customer_stats.agent_id = system_users.id", customerStatsSubQuery).
		Joins("LEFT JOIN (?) AS subscription_stats ON subscription_stats.agent_id = system_users.id", activeSubscriptionStatsSubQuery).
		Joins("LEFT JOIN (?) AS amount_stats ON amount_stats.agent_id = system_users.id", approvedAmountStatsSubQuery).
		Order(orderClause).
		Order("system_users.id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Scan(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	result := make([]AgentDetailDTO, 0, len(list))
	for _, item := range list {
		result = append(result, AgentDetailDTO{
			ID:                      item.ID,
			Username:                item.Username,
			DisplayName:             item.DisplayName,
			Role:                    item.Role,
			CommissionRate:          item.CommissionRate,
			Status:                  item.Status,
			CreatedAt:               item.CreatedAt,
			UpdatedAt:               item.UpdatedAt,
			CustomerCount:           item.CustomerCount,
			ActiveSubscriptionCount: item.ActiveSubscriptionCount,
			ApprovedAmountTotal:     item.ApprovedAmountTotal,
		})
	}

	return &PageResult{List: result, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *AuthService) CreateAgent(dto CreateAgentDTO) (*model.SystemUser, error) {
	dto.Username = strings.TrimSpace(dto.Username)
	dto.DisplayName = strings.TrimSpace(dto.DisplayName)
	if err := validateAgentCommissionRate(dto.CommissionRate); err != nil {
		return nil, err
	}

	status := int16(1)
	if dto.Status != nil {
		status = *dto.Status
	}
	if err := validateAgentStatus(status); err != nil {
		return nil, err
	}
	if err := s.ensureUsernameAvailable(dto.Username, 0, errcode.ErrAgentUsernameDup); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(dto.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	user := model.SystemUser{
		Username:       dto.Username,
		PasswordHash:   string(hash),
		Role:           model.RoleAgent,
		DisplayName:    dto.DisplayName,
		CommissionRate: dto.CommissionRate,
		Status:         status,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &user, nil
}

func (s *AuthService) UpdateAgent(id uint64, dto UpdateAgentDTO) (*model.SystemUser, error) {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleAgent).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrAgentNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	updates := map[string]any{}
	if dto.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*dto.DisplayName)
	}
	if dto.CommissionRate != nil {
		if err := validateAgentCommissionRate(*dto.CommissionRate); err != nil {
			return nil, err
		}
		updates["commission_rate"] = *dto.CommissionRate
	}
	if dto.Status != nil {
		if err := validateAgentStatus(*dto.Status); err != nil {
			return nil, err
		}
		updates["status"] = *dto.Status
	}

	if len(updates) > 0 {
		if err := s.db.Model(&user).Updates(updates).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}
	}
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &user, nil
}

func (s *AuthService) ResetAgentPassword(id uint64, dto ResetAgentPasswordDTO) error {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleAgent).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errcode.ErrAgentNotFound
		}
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(dto.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	if err := s.db.Model(&user).Update("password_hash", string(hash)).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return nil
}

func (s *AuthService) GetAgentDetail(id uint64) (*AgentDetailDTO, error) {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleAgent).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrAgentNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var customerCount int64
	var activeSubCount int64
	var approvedAmount float64

	s.db.Model(&model.Customer{}).Where("agent_id = ?", id).Count(&customerCount)
	s.db.Model(&model.Subscription{}).
		Joins("JOIN customers ON customers.id = subscriptions.customer_id").
		Where("customers.agent_id = ? AND subscriptions.status = ?", id, model.SubscriptionStatusActive).
		Count(&activeSubCount)
	s.db.Model(&model.AccessRequest{}).
		Where("agent_id = ? AND status = ?", id, model.RequestStatusApproved).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&approvedAmount)

	return &AgentDetailDTO{
		ID:                      user.ID,
		Username:                user.Username,
		DisplayName:             user.DisplayName,
		Role:                    user.Role,
		CommissionRate:          user.CommissionRate,
		Status:                  user.Status,
		CreatedAt:               user.CreatedAt,
		UpdatedAt:               user.UpdatedAt,
		CustomerCount:           customerCount,
		ActiveSubscriptionCount: activeSubCount,
		ApprovedAmountTotal:     approvedAmount,
	}, nil
}

func (s *AuthService) ListSubAdmins(filter SubAdminListFilter) (*PageResult, error) {
	filter.Normalize()

	var total int64
	query := s.db.Model(&model.SystemUser{}).Where("role = ?", model.RoleSubAdmin)
	if filter.Keyword != "" {
		query = query.Where("username LIKE ? OR display_name LIKE ?", "%"+filter.Keyword+"%", "%"+filter.Keyword+"%")
	}
	if filter.Status != "" {
		status, err := parseAgentStatusFilter(filter.Status)
		if err != nil {
			return nil, err
		}
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	var list []model.SystemUser
	if err := query.Order("id DESC").
		Offset((filter.Page - 1) * filter.PageSize).
		Limit(filter.PageSize).
		Find(&list).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	return &PageResult{List: list, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

func (s *AuthService) CreateSubAdmin(dto CreateSubAdminDTO) (*model.SystemUser, error) {
	dto.Username = strings.TrimSpace(dto.Username)
	dto.DisplayName = strings.TrimSpace(dto.DisplayName)

	status := int16(1)
	if dto.Status != nil {
		status = *dto.Status
	}
	if err := validateAgentStatus(status); err != nil {
		return nil, err
	}
	if err := s.ensureUsernameAvailable(dto.Username, 0, errcode.ErrSubAdminUsernameDup); err != nil {
		return nil, err
	}

	scriptIDs := uniqueUint64s(dto.ScriptIDs)
	if err := s.ensureScriptsExist(scriptIDs); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(dto.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	user := model.SystemUser{
		Username:       dto.Username,
		PasswordHash:   string(hash),
		Role:           model.RoleSubAdmin,
		DisplayName:    dto.DisplayName,
		CommissionRate: 0,
		Status:         status,
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, tx.Error)
	}
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	if err := s.replaceSubAdminScriptPermissions(tx, user.ID, scriptIDs); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &user, nil
}

func (s *AuthService) GetSubAdminDetail(id uint64) (*SubAdminDetailDTO, error) {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleSubAdmin).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrSubAdminNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	scripts, err := s.loadUserScripts(user.ID)
	if err != nil {
		return nil, err
	}

	return &SubAdminDetailDTO{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		Role:        user.Role,
		Status:      user.Status,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		Scripts:     scripts,
	}, nil
}

func (s *AuthService) UpdateSubAdmin(id uint64, dto UpdateSubAdminDTO) (*model.SystemUser, error) {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleSubAdmin).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrSubAdminNotFound
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	updates := map[string]any{}
	if dto.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*dto.DisplayName)
	}
	if dto.Status != nil {
		if err := validateAgentStatus(*dto.Status); err != nil {
			return nil, err
		}
		updates["status"] = *dto.Status
	}

	if len(updates) > 0 {
		if err := s.db.Model(&user).Updates(updates).Error; err != nil {
			return nil, errcode.Wrap(errcode.ErrInternal, err)
		}
	}
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return &user, nil
}

func (s *AuthService) UpdateSubAdminScripts(id uint64, dto UpdateSubAdminScriptsDTO) error {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleSubAdmin).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errcode.ErrSubAdminNotFound
		}
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	scriptIDs := uniqueUint64s(dto.ScriptIDs)
	if err := s.ensureScriptsExist(scriptIDs); err != nil {
		return err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return errcode.Wrap(errcode.ErrInternal, tx.Error)
	}
	if err := s.replaceSubAdminScriptPermissions(tx, user.ID, scriptIDs); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

func (s *AuthService) ResetSubAdminPassword(id uint64, dto ResetAgentPasswordDTO) error {
	var user model.SystemUser
	if err := s.db.Where("id = ? AND role = ?", id, model.RoleSubAdmin).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errcode.ErrSubAdminNotFound
		}
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(dto.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	if err := s.db.Model(&user).Update("password_hash", string(hash)).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return nil
}

func (s *AuthService) loadAgentStats(agentIDs []uint64) (map[uint64]AgentDetailDTO, error) {
	statsMap := make(map[uint64]AgentDetailDTO, len(agentIDs))
	if len(agentIDs) == 0 {
		return statsMap, nil
	}

	type countRow struct {
		AgentID uint64
		Count   int64
	}
	type amountRow struct {
		AgentID uint64
		Amount  float64
	}

	var customerRows []countRow
	if err := s.db.Model(&model.Customer{}).
		Select("agent_id, COUNT(*) AS count").
		Where("agent_id IN ?", agentIDs).
		Group("agent_id").
		Scan(&customerRows).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	for _, row := range customerRows {
		item := statsMap[row.AgentID]
		item.CustomerCount = row.Count
		statsMap[row.AgentID] = item
	}

	var subscriptionRows []countRow
	if err := s.db.Model(&model.Subscription{}).
		Select("customers.agent_id AS agent_id, COUNT(*) AS count").
		Joins("JOIN customers ON customers.id = subscriptions.customer_id").
		Where("customers.agent_id IN ? AND subscriptions.status = ?", agentIDs, model.SubscriptionStatusActive).
		Group("customers.agent_id").
		Scan(&subscriptionRows).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	for _, row := range subscriptionRows {
		item := statsMap[row.AgentID]
		item.ActiveSubscriptionCount = row.Count
		statsMap[row.AgentID] = item
	}

	var amountRows []amountRow
	if err := s.db.Model(&model.AccessRequest{}).
		Select("agent_id, COALESCE(SUM(amount), 0) AS amount").
		Where("agent_id IN ? AND status = ?", agentIDs, model.RequestStatusApproved).
		Group("agent_id").
		Scan(&amountRows).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	for _, row := range amountRows {
		item := statsMap[row.AgentID]
		item.ApprovedAmountTotal = row.Amount
		statsMap[row.AgentID] = item
	}

	return statsMap, nil
}

func (s *AuthService) loginWithRoles(dto LoginDTO, roles ...string) (*TokenPair, error) {
	var user model.SystemUser
	if err := s.db.Where("username = ? AND role IN ?", dto.Username, roles).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcode.ErrInvalidCredentials
		}
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}

	if user.Status == 0 {
		return nil, errcode.ErrAccountDisabled
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(dto.Password)) != nil {
		return nil, errcode.ErrInvalidCredentials
	}
	return s.issueTokenPair(&user)
}

func (s *AuthService) issueTokenPair(user *model.SystemUser) (*TokenPair, error) {
	accessHours := s.cfg.JWT.AgentExpireHours
	if user.Role == model.RoleAdmin || user.Role == model.RoleSubAdmin || user.Role == model.RoleSuperAdmin {
		accessHours = s.cfg.JWT.AdminExpireHours
	}

	accessToken, err := s.signToken(user, "access", time.Duration(accessHours)*time.Hour)
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.signToken(user, "refresh", time.Duration(s.cfg.JWT.RefreshHours)*time.Hour)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         toUserProfile(user),
	}, nil
}

func (s *AuthService) signToken(user *model.SystemUser, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := TokenClaims{
		UserID:       user.ID,
		Username:     user.Username,
		Role:         user.Role,
		TokenType:    tokenType,
		TokenVersion: normalizedTokenVersion(user.TokenVersion),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.Username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}
	return signed, nil
}

func (s *AuthService) parseToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (any, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*TokenClaims)
	if !ok || !token.Valid {
		return nil, errcode.ErrTokenExpired
	}
	user, err := s.GetUserByID(claims.UserID)
	if err != nil {
		return nil, err
	}
	if normalizedTokenVersion(user.TokenVersion) != normalizedTokenVersion(claims.TokenVersion) {
		return nil, errcode.ErrTokenExpired
	}
	return claims, nil
}

func toUserProfile(user *model.SystemUser) UserProfile {
	return UserProfile{
		ID:             user.ID,
		Username:       user.Username,
		Role:           user.Role,
		DisplayName:    user.DisplayName,
		CommissionRate: user.CommissionRate,
		Status:         user.Status,
	}
}

func toCurrentProfile(user *model.SystemUser) *CurrentProfileDTO {
	return &CurrentProfileDTO{
		ID:             user.ID,
		Username:       user.Username,
		Role:           user.Role,
		DisplayName:    user.DisplayName,
		CommissionRate: user.CommissionRate,
		Status:         user.Status,
		CreatedAt:      user.CreatedAt,
		UpdatedAt:      user.UpdatedAt,
	}
}

func normalizedTokenVersion(value int64) int64 {
	if value <= 0 {
		return 1
	}
	return value
}

func buildUpdateProfileSummary(displayName string) string {
	if strings.TrimSpace(displayName) == "" {
		return "更新了个人资料"
	}
	return "将显示名称更新为 " + displayName
}

func validateAgentCommissionRate(rate float64) error {
	if rate < 0 || rate > 1 {
		return errcode.ErrValidation
	}
	return nil
}

func validateAgentStatus(status int16) error {
	if status != 0 && status != 1 {
		return errcode.ErrValidation
	}
	return nil
}

func validateDisplayName(displayName string) error {
	if displayName == "" {
		return errcode.ErrValidation
	}
	if utf8.RuneCountInString(displayName) > 100 {
		return errcode.ErrValidation
	}
	return nil
}

func parseAgentStatusFilter(input string) (int16, error) {
	switch strings.TrimSpace(strings.ToLower(input)) {
	case "1", "enabled", "active":
		return 1, nil
	case "0", "disabled", "inactive":
		return 0, nil
	default:
		return 0, errcode.ErrValidation
	}
}

func buildAgentSortClause(sortBy, sortOrder string) (string, error) {
	order := strings.TrimSpace(strings.ToLower(sortOrder))
	if order == "" {
		order = "desc"
	}
	if order != "asc" && order != "desc" {
		return "", errcode.ErrValidation
	}

	switch strings.TrimSpace(strings.ToLower(sortBy)) {
	case "", "created_at":
		return "system_users.created_at " + order, nil
	case "approved_amount_total":
		return "COALESCE(amount_stats.approved_amount_total, 0) " + order, nil
	case "active_subscription_count":
		return "COALESCE(subscription_stats.active_subscription_count, 0) " + order, nil
	case "customer_count":
		return "COALESCE(customer_stats.customer_count, 0) " + order, nil
	default:
		return "", errcode.ErrValidation
	}
}

func buildChangePasswordAuditSummary(role string, otherSessionsInvalidated bool) string {
	if role == model.RoleSuperAdmin && otherSessionsInvalidated {
		return "super admin changed the login password and invalidated other sessions"
	}
	if role == model.RoleAdmin {
		return "admin changed the login password"
	}
	if role == model.RoleSubAdmin {
		return "sub admin changed the login password"
	}
	if role == model.RoleAgent {
		return "agent changed the login password"
	}
	return "account changed the login password"
}

func (s *AuthService) ensureUsernameAvailable(username string, excludeID uint64, duplicateErr *errcode.AppError) error {
	var count int64
	query := s.db.Model(&model.SystemUser{}).Where("username = ?", username)
	if excludeID > 0 {
		query = query.Where("id <> ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if count > 0 {
		return duplicateErr
	}
	return nil
}

func (s *AuthService) ensureScriptsExist(scriptIDs []uint64) error {
	if len(scriptIDs) == 0 {
		return nil
	}

	var count int64
	if err := s.db.Model(&model.Script{}).Where("id IN ?", scriptIDs).Count(&count).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if count != int64(len(scriptIDs)) {
		return errcode.ErrTVScriptNotFound
	}
	return nil
}

func (s *AuthService) replaceSubAdminScriptPermissions(tx *gorm.DB, userID uint64, scriptIDs []uint64) error {
	if err := tx.Where("user_id = ?", userID).Delete(&model.UserScriptPermission{}).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	if len(scriptIDs) == 0 {
		return nil
	}

	records := make([]model.UserScriptPermission, 0, len(scriptIDs))
	for _, scriptID := range scriptIDs {
		records = append(records, model.UserScriptPermission{
			UserID:   userID,
			ScriptID: scriptID,
		})
	}
	if err := tx.Create(&records).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return nil
}

func (s *AuthService) loadUserScripts(userID uint64) ([]model.Script, error) {
	var scripts []model.Script
	if err := s.db.Model(&model.Script{}).
		Joins("JOIN user_script_permissions ON user_script_permissions.script_id = scripts.id").
		Where("user_script_permissions.user_id = ?", userID).
		Order("scripts.id DESC").
		Find(&scripts).Error; err != nil {
		return nil, errcode.Wrap(errcode.ErrInternal, err)
	}
	return scripts, nil
}

func uniqueUint64s(values []uint64) []uint64 {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(values))
	result := make([]uint64, 0, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
