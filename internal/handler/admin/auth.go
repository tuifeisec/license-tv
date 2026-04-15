package admin

import (
	"github.com/gin-gonic/gin"

	rootHandler "tv-distribution/internal/handler"
	"tv-distribution/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Login(c *gin.Context) {
	rootHandler.HandleLogin(c, h.auth, "admin", h.auth.LoginAdmin)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	rootHandler.HandleRefresh(c, h.auth, "admin")
}

func (h *AuthHandler) Logout(c *gin.Context) {
	rootHandler.HandleLogout(c, h.auth, "admin")
}

func (h *AuthHandler) Profile(c *gin.Context) {
	rootHandler.HandleProfile(c, h.auth)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	rootHandler.HandleUpdateProfile(c, h.auth)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	rootHandler.HandleChangePassword(c, h.auth)
}
