package services

import (
	"go-server/src/models"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/google/uuid"
)

var (
	users = make(map[string]models.User)
	mu    sync.Mutex
)

// gin context = all info about the reuest
func GetUser(c *gin.Context) {
	id, ok := c.GetQuery("id")

	if ok {
		c.JSON(http.StatusOK, gin.H{message: id})
		return
	}
	else {
		return c.JSON(http.StatusNotFound, gin.H{message: "not found"})
	}
}
func CreateUser(user models.User) models.User {
	user.ID = uuid.New().String()

	//if another go routine calls this , wait until is unlock
	mu.Lock()
	defer mu.Unlock()

	users[user.id] = user

	return user
}
