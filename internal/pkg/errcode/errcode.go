package errcode

import (
	"errors"
	"net/http"
)

type AppError struct {
	Code       int
	Message    string
	HTTPStatus int
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func New(code int, message string, httpStatus int) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: httpStatus}
}

func Wrap(base *AppError, err error) *AppError {
	if err == nil {
		return base
	}
	return &AppError{
		Code:       base.Code,
		Message:    base.Message,
		HTTPStatus: base.HTTPStatus,
		Err:        err,
	}
}

func FromError(err error) *AppError {
	if err == nil {
		return nil
	}
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return Wrap(ErrInternal, err)
}

var (
	ErrInternal             = New(10999, "internal server error", http.StatusInternalServerError)
	ErrValidation           = New(10001, "invalid request parameters", http.StatusBadRequest)
	ErrUnauthorized         = New(10002, "unauthorized", http.StatusUnauthorized)
	ErrForbidden            = New(10003, "permission denied", http.StatusForbidden)
	ErrAccountDisabled      = New(10004, "account disabled", http.StatusForbidden)
	ErrInvalidCredentials   = New(10005, "invalid username or password", http.StatusUnauthorized)
	ErrTokenExpired         = New(10006, "token expired or invalid", http.StatusUnauthorized)
	ErrPaymentProofInvalid  = New(10007, "payment proof file is invalid", http.StatusBadRequest)
	ErrPaymentProofTooLarge = New(10008, "payment proof file is too large", http.StatusBadRequest)
	ErrTVInvalidCookie      = New(10100, "TradingView cookie invalid", http.StatusBadGateway)
	ErrTVUsernameNotFound   = New(10101, "TV username not found", http.StatusBadRequest)
	ErrTVScriptNotFound     = New(10102, "TV script not found", http.StatusBadRequest)
	ErrTVAccessFailed       = New(10103, "TradingView authorization failed", http.StatusBadGateway)
	ErrRequestNotFound      = New(10200, "access request not found", http.StatusNotFound)
	ErrRequestStatus        = New(10201, "request status does not allow this action", http.StatusBadRequest)
	ErrDuplicateRequest     = New(10202, "duplicate pending request exists", http.StatusBadRequest)
	ErrSubscriptionExists   = New(10300, "active subscription already exists", http.StatusBadRequest)
	ErrSubscriptionNotFound = New(10301, "subscription not found", http.StatusNotFound)
	ErrSubscriptionRevoked  = New(10302, "subscription revoke failed", http.StatusBadRequest)
	ErrCustomerNotFound     = New(10400, "customer not found", http.StatusNotFound)
	ErrCustomerUsernameDup  = New(10401, "TV username already exists", http.StatusBadRequest)
	ErrAgentNotFound        = New(10500, "agent not found", http.StatusNotFound)
	ErrAgentDisabled        = New(10501, "agent disabled", http.StatusForbidden)
	ErrAgentUsernameDup     = New(10502, "agent username already exists", http.StatusBadRequest)
	ErrSubAdminNotFound     = New(10600, "sub admin not found", http.StatusNotFound)
	ErrSubAdminUsernameDup  = New(10601, "sub admin username already exists", http.StatusBadRequest)
	ErrScriptNotPermitted   = New(10602, "no permission for this script", http.StatusForbidden)
)
