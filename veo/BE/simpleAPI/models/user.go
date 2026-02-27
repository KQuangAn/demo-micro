package models

type User struct {
	ID     string `json:"id" binding:"required"`          //upercase field = exported ( public ) binding = validation
	Name   string `json:"name" binding:"required"`        //upercase field = exported ( public ) binding = validation
	Age    int    `json:"age" binding:"required,numeric"` //upercase field = exported ( public )
	secret string `json:"secret" binding:"required"`      //lowercase field = private ( public )
}
