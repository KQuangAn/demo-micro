package validator

import (
	"encoding/json"
	"log"

	"github.com/go-playground/validator/v10"
)

type Validator struct {
	validate *validator.Validate
}

func New() *Validator {
	return &Validator{validate: validator.New()}
}

func (v *Validator) Validate(msgBody string, model interface{}) bool {
	err := json.Unmarshal([]byte(msgBody), model)
	if err != nil {
		log.Printf("Invalid JSON format: %v", err)
		return false
	}

	err = v.validate.Struct(model)
	if err != nil {
		for _, e := range err.(validator.ValidationErrors) {
			log.Printf("Validation failed for field '%s': %s", e.Field(), e.Tag())
		}
		return false
	}

	return true
}
