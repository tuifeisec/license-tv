package handler

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/authcookie"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

func HandleLogin(c *gin.Context, auth *service.AuthService, scope string, login func(service.LoginDTO) (*service.TokenPair, error)) {
	var req service.LoginDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}

	result, err := login(req)
	if err != nil {
		response.Error(c, err)
		return
	}

	setSessionCookies(c, auth, scope, result)
	response.Success(c, result)
}

func HandleRefresh(c *gin.Context, auth *service.AuthService, scope string) {
	var req service.RefreshTokenDTO
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		response.Error(c, errcode.ErrValidation)
		return
	}

	refreshToken := req.RefreshToken
	if refreshToken == "" {
		cookieValue, err := c.Cookie(authcookie.RefreshTokenName)
		if err == nil {
			refreshToken = cookieValue
		}
	}
	if refreshToken == "" {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	result, err := auth.Refresh(refreshToken)
	if err != nil {
		response.Error(c, err)
		return
	}

	setSessionCookies(c, auth, scope, result)
	response.Success(c, result)
}

func HandleProfile(c *gin.Context, auth *service.AuthService) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	result, err := auth.GetCurrentProfile(user.UserID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func HandleUpdateProfile(c *gin.Context, auth *service.AuthService) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	var req service.UpdateProfileDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}

	result, err := auth.UpdateCurrentProfile(user.UserID, req, middleware.ClientIP(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func HandleChangePassword(c *gin.Context, auth *service.AuthService) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	var req service.ChangePasswordDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}

	result, err := auth.ChangePassword(user.UserID, req, middleware.ClientIP(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	if result.Session != nil {
		scope := "agent"
		if user.Role == "admin" || user.Role == "super_admin" {
			scope = "admin"
		}
		setSessionCookies(c, auth, scope, result.Session)
	}
	response.Success(c, result)
}

func HandleLogout(c *gin.Context, auth *service.AuthService, scope string) {
	clearSessionCookies(c, auth, scope)
	c.JSON(http.StatusOK, response.Envelope{
		Code:    0,
		Message: "success",
		Data: gin.H{
			"logged_out": true,
		},
	})
}

func setSessionCookies(c *gin.Context, auth *service.AuthService, scope string, session *service.TokenPair) {
	c.SetSameSite(auth.CookieSameSite())
	c.SetCookie(
		authcookie.AccessTokenName,
		session.AccessToken,
		int(auth.AccessTokenTTL(session.User.Role).Seconds()),
		authcookie.ScopePath(scope),
		auth.CookieDomain(),
		auth.CookieSecure(),
		true,
	)
	c.SetCookie(
		authcookie.RefreshTokenName,
		session.RefreshToken,
		int(auth.RefreshTokenTTL().Seconds()),
		authcookie.ScopePath(scope),
		auth.CookieDomain(),
		auth.CookieSecure(),
		true,
	)
}

func clearSessionCookies(c *gin.Context, auth *service.AuthService, scope string) {
	c.SetSameSite(auth.CookieSameSite())
	c.SetCookie(authcookie.AccessTokenName, "", -1, authcookie.ScopePath(scope), auth.CookieDomain(), auth.CookieSecure(), true)
	c.SetCookie(authcookie.RefreshTokenName, "", -1, authcookie.ScopePath(scope), auth.CookieDomain(), auth.CookieSecure(), true)
}
