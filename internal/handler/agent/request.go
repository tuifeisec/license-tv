package agent

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

const (
	maxPaymentProofSize = 5 << 20
	paymentProofDir     = "uploads/payment-proofs"
)

var allowedPaymentProofTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type RequestHandler struct {
	reviews *service.ReviewService
}

func NewRequestHandler(reviews *service.ReviewService) *RequestHandler {
	return &RequestHandler{reviews: reviews}
}

func (h *RequestHandler) Create(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.SubmitRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.reviews.SubmitRequest(user.UserID, req)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *RequestHandler) UploadPaymentProof(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	if file.Size <= 0 {
		response.Error(c, errcode.ErrPaymentProofInvalid)
		return
	}
	if file.Size > maxPaymentProofSize {
		response.Error(c, errcode.ErrPaymentProofTooLarge)
		return
	}

	contentType, extension, err := sniffPaymentProof(file)
	if err != nil {
		response.Error(c, err)
		return
	}

	filename, err := buildPaymentProofFilename(extension)
	if err != nil {
		response.Error(c, errcode.Wrap(errcode.ErrInternal, err))
		return
	}

	if err := os.MkdirAll(paymentProofDir, 0o755); err != nil {
		response.Error(c, errcode.Wrap(errcode.ErrInternal, err))
		return
	}

	relativePath := filepath.ToSlash(filepath.Join(paymentProofDir, filename))
	if err := c.SaveUploadedFile(file, relativePath); err != nil {
		response.Error(c, errcode.Wrap(errcode.ErrInternal, err))
		return
	}

	response.Success(c, gin.H{
		"url":          buildPublicURL(c, relativePath),
		"path":         "/" + relativePath,
		"content_type": contentType,
		"size":         file.Size,
	})
}

func (h *RequestHandler) List(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var filter service.RequestFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.reviews.ListMyRequests(user.UserID, filter)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *RequestHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	result, err := h.reviews.GetByID(id, &user.UserID, service.Unrestricted())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *RequestHandler) Cancel(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	if err := h.reviews.CancelRequest(user.UserID, id); err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, gin.H{"cancelled": true})
}

func sniffPaymentProof(fileHeader *multipart.FileHeader) (string, string, error) {
	file, err := fileHeader.Open()
	if err != nil {
		return "", "", errcode.Wrap(errcode.ErrInternal, err)
	}
	defer file.Close()

	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", "", errcode.Wrap(errcode.ErrInternal, err)
	}

	contentType := http.DetectContentType(buffer[:n])
	extension, ok := allowedPaymentProofTypes[contentType]
	if !ok {
		return "", "", errcode.ErrPaymentProofInvalid
	}
	return contentType, extension, nil
}

func buildPaymentProofFilename(extension string) (string, error) {
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return fmt.Sprintf("%d-%s%s", time.Now().UTC().Unix(), hex.EncodeToString(randomBytes), extension), nil
}

func buildPublicURL(c *gin.Context, relativePath string) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = forwardedProto
	}
	return fmt.Sprintf("%s://%s/%s", scheme, c.Request.Host, filepath.ToSlash(relativePath))
}
