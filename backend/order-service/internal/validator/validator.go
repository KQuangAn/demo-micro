package validator

import (
	"encoding/json"
	"log"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

type Validator struct {
	validate *validator.Validate
}

func New() *Validator {
	return &Validator{validate: validator.New()}
}
func ValidateModel[T any](v *Validator, data any, model *T) *T {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling data: %v", err)
		return nil
	}

	modelType := reflect.TypeOf(model)
	isSlice := false
	elemType := modelType

	if modelType.Kind() == reflect.Ptr && modelType.Elem().Kind() == reflect.Slice {
		isSlice = true
		elemType = modelType.Elem().Elem()
	}

	if isSlice {
		slicePtr := reflect.New(reflect.SliceOf(elemType)).Interface()
		if err := json.Unmarshal(dataBytes, slicePtr); err != nil {
			log.Printf("Invalid JSON format for slice: %v", err)
			return nil
		}

		s := reflect.ValueOf(slicePtr).Elem()
		for i := 0; i < s.Len(); i++ {
			elem := s.Index(i).Interface()
			if err := v.validate.Struct(elem); err != nil {
				log.Printf("Validation failed for item %d: %v", i, err)
				return nil
			}
		}
		return slicePtr.(*T)
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

	if err := v.validate.Struct(model); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
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
