package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"tv-distribution/internal/config"
	"tv-distribution/internal/model"
	"tv-distribution/internal/pkg/errcode"
)

const settingKeyTVCookies = "tradingview.cookies"
const encryptedValuePrefix = "enc:v1:"

type tvCookiePayload struct {
	SessionID     string `json:"sessionid"`
	SessionIDSign string `json:"sessionid_sign"`
}

type SystemSettingService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSystemSettingService(db *gorm.DB, cfg *config.Config) *SystemSettingService {
	return &SystemSettingService{db: db, cfg: cfg}
}

func (s *SystemSettingService) SaveTVCookies(sessionID, sessionIDSign string) error {
	payload, err := json.Marshal(tvCookiePayload{
		SessionID:     sessionID,
		SessionIDSign: sessionIDSign,
	})
	if err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}

	encryptedPayload, err := s.encryptSettingValue(string(payload))
	if err != nil {
		return err
	}

	setting := model.SystemSetting{
		SettingKey:   settingKeyTVCookies,
		SettingValue: encryptedPayload,
		Description:  "Persisted TradingView session cookies",
	}

	if err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "setting_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"setting_value", "description", "updated_at"}),
	}).Create(&setting).Error; err != nil {
		return errcode.Wrap(errcode.ErrInternal, err)
	}
	return nil
}

func (s *SystemSettingService) LoadTVCookies() (string, string, error) {
	var setting model.SystemSetting
	if err := s.db.Where("setting_key = ?", settingKeyTVCookies).First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", "", nil
		}
		return "", "", errcode.Wrap(errcode.ErrInternal, err)
	}

	rawValue, err := s.decryptSettingValue(setting.SettingValue)
	if err != nil {
		return "", "", err
	}

	var payload tvCookiePayload
	if err := json.Unmarshal([]byte(rawValue), &payload); err != nil {
		return "", "", errcode.Wrap(errcode.ErrInternal, err)
	}
	return payload.SessionID, payload.SessionIDSign, nil
}

func (s *SystemSettingService) encryptionSecret() string {
	if strings.TrimSpace(s.cfg.Security.DataEncryptionKey) != "" {
		return s.cfg.Security.DataEncryptionKey
	}
	return s.cfg.JWT.Secret
}

func (s *SystemSettingService) encryptSettingValue(value string) (string, error) {
	keySource := strings.TrimSpace(s.encryptionSecret())
	if keySource == "" {
		return "", errcode.Wrap(errcode.ErrInternal, errors.New("missing encryption secret"))
	}

	key := sha256.Sum256([]byte(keySource))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	cipherText := gcm.Seal(nil, nonce, []byte(value), nil)
	encoded := base64.StdEncoding.EncodeToString(append(nonce, cipherText...))
	return encryptedValuePrefix + encoded, nil
}

func (s *SystemSettingService) decryptSettingValue(value string) (string, error) {
	if !strings.HasPrefix(value, encryptedValuePrefix) {
		return value, nil
	}

	keySource := strings.TrimSpace(s.encryptionSecret())
	if keySource == "" {
		return "", errcode.Wrap(errcode.ErrInternal, errors.New("missing encryption secret"))
	}

	key := sha256.Sum256([]byte(keySource))
	rawCipher, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, encryptedValuePrefix))
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	if len(rawCipher) < gcm.NonceSize() {
		return "", errcode.Wrap(errcode.ErrInternal, fmt.Errorf("encrypted setting payload too short"))
	}

	nonce := rawCipher[:gcm.NonceSize()]
	cipherText := rawCipher[gcm.NonceSize():]
	plainText, err := gcm.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return "", errcode.Wrap(errcode.ErrInternal, err)
	}

	return string(plainText), nil
}
