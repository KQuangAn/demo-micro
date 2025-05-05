package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"api-gateway/models"
	"api-gateway/redis"

	"github.com/golang-jwt/jwt"
	log "github.com/jensneuse/abstractlogger"
	"golang.org/x/crypto/bcrypt"
)

var (
	mySigningKey = []byte(os.Getenv("JWT_SECRET"))
	ctx          = context.Background()
	logger       = log.Noop{}
)

func comparePassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

func respondWithError(w http.ResponseWriter, code int, message string, err error) {
	if err != nil {
		logger.Error(message, log.Error(err))
	} else {
		logger.Error(message)
	}
	http.Error(w, message, code)
}

func respondWithJSON(w http.ResponseWriter, code int, payload any) {
	response, err := json.Marshal(payload)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to encode response", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func GenerateToken(username string) (string, error) {
	claims := &models.Claims{
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(72 * time.Hour).Unix(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(mySigningKey)
}

type LoginResponse struct {
	Message string       `json:"message"`
	Data    UserResponse `json:"data"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var creds models.Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	client := redis.Client()

	storedPassword, err := client.HGet(ctx, creds.Username, "password").Result()
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "User not found", err)
		return
	}

	if !comparePassword(storedPassword, creds.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := GenerateToken(creds.Username)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not generate token", err)
		return
	}

	// Set token as HTTP-only cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Expires:  time.Now().Add(72 * time.Hour),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	})

	w.WriteHeader(http.StatusOK)

	userId, err := client.HGet(ctx, creds.Username, "user_id").Result()
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "User id not found", err)
		return
	}
	response := LoginResponse{
		Message: "Logged in successfully",
		Data: UserResponse{
			ID:       userId,
			Username: creds.Username,
		},
	}

	json.NewEncoder(w).Encode(response)
}

func TokenValid(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		if tokenString == "" {
			respondWithError(w, http.StatusUnauthorized, "Missing token", nil)
			return
		}

		claims := &models.Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
			return mySigningKey, nil
		})

		if err != nil || !token.Valid {
			respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
			return
		}

		next.ServeHTTP(w, r)
	})
}
