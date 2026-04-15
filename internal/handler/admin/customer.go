package admin

import (
	"github.com/gin-gonic/gin"

	"tv-distribution/internal/middleware"
	"tv-distribution/internal/pkg/errcode"
	"tv-distribution/internal/pkg/response"
	"tv-distribution/internal/service"
)

type CustomerHandler struct {
	customers *service.CustomerService
}

func NewCustomerHandler(customers *service.CustomerService) *CustomerHandler {
	return &CustomerHandler{customers: customers}
}

func (h *CustomerHandler) List(c *gin.Context) {
	var filter service.CustomerFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.customers.List(filter, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Page(c, result)
}

func (h *CustomerHandler) Create(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		response.Error(c, errcode.ErrUnauthorized)
		return
	}
	var req service.CreateCustomerDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.customers.Create(req, &user.UserID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *CustomerHandler) Get(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.customers.GetByID(id, nil, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *CustomerHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateCustomerDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.customers.Update(id, nil, req, extractScriptScope(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}

func (h *CustomerHandler) ValidateTVUsername(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		keyword = c.Query("s")
	}
	if keyword == "" {
		response.Error(c, errcode.ErrValidation)
		return
	}
	result, err := h.customers.ValidateTVUsername(keyword)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Success(c, result)
}
