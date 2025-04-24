package validator

import (
	"encoding/json"
	"fmt"
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

func (v *Validator) Validate(msgBody *types.Message, model interface{}) bool {
	err := json.Unmarshal([]byte(*msgBody.Body), model)
	if err != nil {
		log.Printf("Invalid JSON format: %v", err)
		return false
	}
	fmt.Println(model, []byte(*msgBody.Body))

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
