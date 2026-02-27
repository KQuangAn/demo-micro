package helper

import "fmt"

func TypeCheck(x any) {
	var typeName = "any"

	switch x.(type) {
	case bool:
		typeName = "bool"
	case int:
		typeName = "int"
	case interface{}:
		typeName = "interface"
	case string:
		typeName = "string"
	default:
		typeName = "unknown"
	}

	fmt.Println("Type:", typeName)
}
