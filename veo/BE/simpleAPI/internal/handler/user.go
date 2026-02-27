package controllers

import (
	"go-server/src/models"
	"helper"
	"net/http"
	"user-service/src/service/user"
)

// pacakage name is the same as last element of the import path
type UserHandler struct {
	service user.Service
}

func NewUserHandler(service user.Service) *UserHandler {
	return &UserHandler{
		service: service,
	}
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	const body = helper.TypeCheck(r.GetBody())

	if err := json.newDecoder(r.Body).Decode(&user); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
}
