package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

const url = "http://localhost:80"

type any = interface{}

func main() {
	log.setReportCaller(true)

	mux := http.NewServeMux()
	r := gin.Default()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "he;p")
	})
	r.GET("/user", getBooks)
	r.Run("")
	http.Handle("GET /", r)
	http.ListenAndServe(":8000", nil)

}
