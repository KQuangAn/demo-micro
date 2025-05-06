package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt"
)

func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var tokenString string

		authorizationHeader := r.Header.Get("Authorization")
		if authorizationHeader != "" {
			tokenString = strings.TrimPrefix(authorizationHeader, "Bearer ")
			if tokenString == authorizationHeader {
				http.Error(w, "Authorization token is missing", http.StatusUnauthorized)
				return
			}
		} else {
			cookie, err := r.Cookie("token")
			if err == nil {
				tokenString = cookie.Value
			} else {
				http.Error(w, "Authorization header or cookie is missing", http.StatusUnauthorized)
				return
			}
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}
