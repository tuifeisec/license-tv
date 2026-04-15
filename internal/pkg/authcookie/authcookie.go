package authcookie

const (
	AccessTokenName  = "tvd_access_token"
	RefreshTokenName = "tvd_refresh_token"
)

func ScopePath(scope string) string {
	switch scope {
	case "admin":
		return "/api/admin/v1"
	case "agent":
		return "/api/agent/v1"
	default:
		return "/"
	}
}
