package service

import "tv-distribution/internal/pkg/errcode"

type TVSessionService struct {
	tv       TVProxy
	settings *SystemSettingService
}

func NewTVSessionService(tv TVProxy, settings *SystemSettingService) *TVSessionService {
	return &TVSessionService{
		tv:       tv,
		settings: settings,
	}
}

func (s *TVSessionService) LoadPersistedCookies() error {
	sessionID, sessionIDSign, err := s.settings.LoadTVCookies()
	if err != nil {
		return err
	}
	if sessionID == "" || sessionIDSign == "" {
		return nil
	}

	s.tv.UpdateCookies(sessionID, sessionIDSign)
	return nil
}

func (s *TVSessionService) UpdateCookies(sessionID, sessionIDSign string) error {
	if sessionID == "" || sessionIDSign == "" {
		return errcode.ErrValidation
	}
	if err := s.settings.SaveTVCookies(sessionID, sessionIDSign); err != nil {
		return err
	}
	s.tv.UpdateCookies(sessionID, sessionIDSign)
	return nil
}

func (s *TVSessionService) SessionStatus() TVSessionStatus {
	return s.tv.SessionStatus()
}

func (s *TVSessionService) ValidateSession() (*TVAccountInfo, error) {
	return s.tv.ValidateSession()
}
