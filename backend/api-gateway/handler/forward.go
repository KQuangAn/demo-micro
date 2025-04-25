package handlers

import (
	"api-gateway/models"
	"io"
	"net/http"
	"os"

	"github.com/dgrijalva/jwt-go"
)

func ForwardGraphQLRequest(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	if err := ValidateToken(tokenString); err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	graphqlServiceURL := os.Getenv("GRAPHQL_SERVICE_URL")
	req, err := http.NewRequest(r.Method, graphqlServiceURL+r.URL.Path, r.Body)
	if err != nil {
		http.Error(w, "Could not create request", http.StatusInternalServerError)
		return
	}

	req.Header = r.Header

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Error contacting GraphQL service", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	for key, value := range resp.Header {
		w.Header()[key] = value
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func ValidateToken(tokenString string) error {
	claims := &models.Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		return err
	}
	return nil
}
