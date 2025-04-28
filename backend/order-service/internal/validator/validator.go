package validator

import (
	"encoding/json"
	"log"
	"reflect"
	"strings"

	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/go-playground/validator/v10"
)

type Validator struct {
	validate *validator.Validate
}

func New() *Validator {
	return &Validator{validate: validator.New()}
}

func (v *Validator) ValidateEvent(msgBody *types.Message, model interface{}) bool {
	err := json.Unmarshal([]byte(*msgBody.Body), model)
	if err != nil {
		log.Printf("Invalid JSON format: %v", err)
		return false
	}

	v.validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})
	err = v.validate.Struct(model)
	if err != nil {
		validationErrors, ok := err.(validator.ValidationErrors)
		if ok {
			for _, e := range validationErrors {
				log.Printf("Validation failed for field '%s': %s", e.Field(), e.Tag())
			}
		} else {
			log.Printf("Validation error: %v", err)
		}
		return false
	}

	return true
}

func ValidateModel[T any](v *Validator, data interface{}, model *T) *T {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling data: %v", err)
		return nil
	}

	if err := json.Unmarshal(dataBytes, model); err != nil {
		log.Printf("Invalid JSON format: %v", err)
		return nil
	}

	v.validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})

	err = v.validate.Struct(model)
	if err != nil {
		validationErrors, ok := err.(validator.ValidationErrors)
		if ok {
			for _, e := range validationErrors {
				log.Printf("Validation failed for field '%s': %s", e.Field(), e.Tag())
			}
		} else {
			log.Printf("Validation error: %v", err)
		}
		return nil
	}

	return model
}
