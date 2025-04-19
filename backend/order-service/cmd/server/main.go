package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"github.com/labstack/echo/v4"
)

type Order struct {
	ID       string `json:"id"`
	Product  string `json:"product"`
	Quantity int    `json:"quantity"`
}

func main() {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("ap-southeast-1"))
	if err != nil {
		log.Fatalf("unable to load SDK config: %v", err)
	}
	eb := eventbridge.NewFromConfig(cfg)
	busName := os.Getenv("EVENT_BUS_NAME")

	e := echo.New()
	e.POST("/order", func(c echo.Context) error {
		order := Order{}
		if err := c.Bind(&order); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid input"})
		}

		detail, _ := json.Marshal(order)
		_, err := eb.PutEvents(context.TODO(), &eventbridge.PutEventsInput{
			Entries: []eventbridgetypes.PutEventsRequestEntry{
				{
					Source:       aws.String("order.service"),
					DetailType:   aws.String("OrderPlaced"),
					EventBusName: aws.String(busName),
					Detail:       aws.String(string(detail)),
				},
			},
		})

		if err != nil {
			log.Println("failed to send event:", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "event failed"})
		}

		return c.JSON(http.StatusOK, map[string]string{"status": "event sent"})
	})

	e.Logger.Fatal(e.Start(":8080"))
}
