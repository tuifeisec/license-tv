package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/pkg/errcode"
)

type Envelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Envelope{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func Page(c *gin.Context, result any) {
	Success(c, result)
}

func Error(c *gin.Context, err error) {
	appErr := errcode.FromError(err)
	c.JSON(appErr.HTTPStatus, Envelope{
		Code:    appErr.Code,
		Message: appErr.Message,
		Data:    nil,
	})
}
