package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

const (
	endpoint  = "http://localhost:4566"
	region    = "us-east-1"
	tableName = "Users"
)

func main() {
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("  Creating DynamoDB Table")
	fmt.Println(strings.Repeat("=", 60))

	// Create AWS session for LocalStack
	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Endpoint:    aws.String(endpoint),
		Credentials: credentials.NewStaticCredentials("test", "test", ""),
	})
	if err != nil {
		log.Fatalf("Failed to create session: %v", err)
	}

	svc := dynamodb.New(sess)

	// Check connection
	_, err = svc.ListTables(&dynamodb.ListTablesInput{})
	if err != nil {
		fmt.Println("✗ Cannot connect to LocalStack")
		fmt.Println("  Please start LocalStack: docker-compose up -d")
		return
	}
	fmt.Println("✓ Connected to LocalStack")

	// Create table
	if err := createTable(svc); err != nil {
		log.Printf("Failed to create table: %v", err)
		return
	}

	// Wait for table to be active
	fmt.Println("\nWaiting for table to be active...")
	if err := waitForTable(svc); err != nil {
		log.Printf("Error waiting for table: %v", err)
		return
	}

	// Describe table
	describeTable(svc)

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("Next step: Run 'go run cmd/app/main.go' to see examples!")
	fmt.Println(strings.Repeat("=", 60))
}

func createTable(svc *dynamodb.DynamoDB) error {
	input := &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []*dynamodb.KeySchemaElement{
			{
				AttributeName: aws.String("user_id"),
				KeyType:       aws.String("HASH"), // Partition key
			},
			{
				AttributeName: aws.String("timestamp"),
				KeyType:       aws.String("RANGE"), // Sort key
			},
		},
		AttributeDefinitions: []*dynamodb.AttributeDefinition{
			{
				AttributeName: aws.String("user_id"),
				AttributeType: aws.String("S"), // String
			},
			{
				AttributeName: aws.String("timestamp"),
				AttributeType: aws.String("N"), // Number
			},
		},
		BillingMode: aws.String("PAY_PER_REQUEST"),
	}

	_, err := svc.CreateTable(input)
	if err != nil {
		if _, ok := err.(*dynamodb.ResourceInUseException); ok {
			fmt.Printf("✓ Table '%s' already exists.\n", tableName)
			return nil
		}
		return fmt.Errorf("failed to create table: %v", err)
	}

	fmt.Printf("✓ Table '%s' created successfully!\n", tableName)
	fmt.Println("  Partition Key: user_id (String)")
	fmt.Println("  Sort Key: timestamp (Number)")
	return nil
}

func waitForTable(svc *dynamodb.DynamoDB) error {
	maxAttempts := 30
	for i := 0; i < maxAttempts; i++ {
		output, err := svc.DescribeTable(&dynamodb.DescribeTableInput{
			TableName: aws.String(tableName),
		})
		if err != nil {
			return err
		}

		if *output.Table.TableStatus == "ACTIVE" {
			fmt.Println("✓ Table is active")
			return nil
		}

		time.Sleep(time.Second)
	}
	return fmt.Errorf("table did not become active in time")
}

func describeTable(svc *dynamodb.DynamoDB) {
	output, err := svc.DescribeTable(&dynamodb.DescribeTableInput{
		TableName: aws.String(tableName),
	})
	if err != nil {
		log.Printf("Error describing table: %v", err)
		return
	}

	table := output.Table
	fmt.Println("\n--- Table Information ---")
	fmt.Printf("Name: %s\n", *table.TableName)
	fmt.Printf("Status: %s\n", *table.TableStatus)
	fmt.Printf("Item Count: %d\n", *table.ItemCount)
	fmt.Printf("Size: %d bytes\n", *table.TableSizeBytes)
	fmt.Printf("Created: %s\n", table.CreationDateTime.String())
}
