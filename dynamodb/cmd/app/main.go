package main

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

const (
	endpoint  = "http://localhost:4566"
	region    = "us-east-1"
	tableName = "Users"
)

// User represents a user item in DynamoDB
type User struct {
	UserID    string `json:"user_id"`
	Timestamp int64  `json:"timestamp"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Age       int    `json:"age"`
	Status    string `json:"status"`
}

var svc *dynamodb.DynamoDB

func init() {
	// Create AWS session for LocalStack
	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Endpoint:    aws.String(endpoint),
		Credentials: credentials.NewStaticCredentials("test", "test", ""),
	})
	if err != nil {
		log.Fatalf("Failed to create session: %v", err)
	}

	svc = dynamodb.New(sess)
}

func main() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("\n✗ Error: %v\n", r)
			fmt.Println("\nMake sure:")
			fmt.Println("1. LocalStack is running: docker-compose up -d")
			fmt.Println("2. The table exists: go run cmd/create_table/main.go")
		}
	}()

	printSection("DynamoDB LocalStack Demo")

	// Store timestamps for later use
	timestamps := make(map[string]int64)

	// 1. CREATE - Add new items
	printSection("1. CREATE Operations")
	timestamps["user_001"] = time.Now().Unix()
	createItem("user_001", "Alice Johnson", "alice@example.com", 30, timestamps["user_001"])

	time.Sleep(100 * time.Millisecond)
	timestamps["user_002"] = time.Now().Unix()
	createItem("user_002", "Bob Smith", "bob@example.com", 25, timestamps["user_002"])

	time.Sleep(100 * time.Millisecond)
	timestamps["user_003"] = time.Now().Unix()
	createItem("user_003", "Charlie Brown", "charlie@example.com", 45, timestamps["user_003"])

	// 2. READ - Get items
	printSection("2. READ Operations")
	getItem("user_001", timestamps["user_001"])
	getItem("user_002", timestamps["user_002"])

	// 3. UPDATE - Modify an item
	printSection("3. UPDATE Operations")
	updateItem("user_001", timestamps["user_001"], "alice.johnson@newdomain.com")

	// Verify update
	getItem("user_001", timestamps["user_001"])

	// 4. SCAN - Get all items
	printSection("4. SCAN Operations")
	scanTable(0)

	// Scan with filter
	fmt.Println("\n--- Filtered Scan (age >= 30) ---")
	scanTable(30)

	// 5. QUERY - Query by partition key
	printSection("5. QUERY Operations")
	queryByUserID("user_001")

	// 6. BATCH WRITE
	printSection("6. BATCH WRITE Operations")
	batchWriteItems()

	// Show all items after batch write
	fmt.Println("\n--- All items after batch write ---")
	scanTable(0)

	// 7. DELETE - Remove an item
	printSection("7. DELETE Operations")
	deleteItem("user_003", timestamps["user_003"])

	// Verify deletion
	fmt.Println("\n--- Items after deletion ---")
	scanTable(0)

	printSection("Demo Complete!")
	fmt.Println("Check the README.md for more information and next steps.")
}

func printSection(title string) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Printf("  %s\n", title)
	fmt.Println(strings.Repeat("=", 60))
}

func createItem(userID, name, email string, age int, timestamp int64) {
	user := User{
		UserID:    userID,
		Timestamp: timestamp,
		Name:      name,
		Email:     email,
		Age:       age,
		Status:    "active",
	}

	av, err := dynamodbattribute.MarshalMap(user)
	if err != nil {
		fmt.Printf("✗ Error marshaling item: %v\n", err)
		return
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      av,
	}

	_, err = svc.PutItem(input)
	if err != nil {
		fmt.Printf("✗ Error creating item: %v\n", err)
		return
	}

	fmt.Printf("✓ Created user: %s (ID: %s)\n", name, userID)
}

func getItem(userID string, timestamp int64) *User {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key: map[string]*dynamodb.AttributeValue{
			"user_id": {
				S: aws.String(userID),
			},
			"timestamp": {
				N: aws.String(strconv.FormatInt(timestamp, 10)),
			},
		},
	}

	result, err := svc.GetItem(input)
	if err != nil {
		fmt.Printf("✗ Error getting item: %v\n", err)
		return nil
	}

	if result.Item == nil {
		fmt.Println("✗ Item not found")
		return nil
	}

	var user User
	err = dynamodbattribute.UnmarshalMap(result.Item, &user)
	if err != nil {
		fmt.Printf("✗ Error unmarshaling item: %v\n", err)
		return nil
	}

	fmt.Printf("✓ Retrieved: %s - %s\n", user.Name, user.Email)
	return &user
}

func updateItem(userID string, timestamp int64, newEmail string) {
	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(tableName),
		Key: map[string]*dynamodb.AttributeValue{
			"user_id": {
				S: aws.String(userID),
			},
			"timestamp": {
				N: aws.String(strconv.FormatInt(timestamp, 10)),
			},
		},
		UpdateExpression: aws.String("SET email = :email, #st = :status"),
		ExpressionAttributeNames: map[string]*string{
			"#st": aws.String("status"), // 'status' is a reserved word
		},
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":email": {
				S: aws.String(newEmail),
			},
			":status": {
				S: aws.String("updated"),
			},
		},
		ReturnValues: aws.String("ALL_NEW"),
	}

	_, err := svc.UpdateItem(input)
	if err != nil {
		fmt.Printf("✗ Error updating item: %v\n", err)
		return
	}

	fmt.Printf("✓ Updated email to: %s\n", newEmail)
}

func deleteItem(userID string, timestamp int64) {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(tableName),
		Key: map[string]*dynamodb.AttributeValue{
			"user_id": {
				S: aws.String(userID),
			},
			"timestamp": {
				N: aws.String(strconv.FormatInt(timestamp, 10)),
			},
		},
		ReturnValues: aws.String("ALL_OLD"),
	}

	result, err := svc.DeleteItem(input)
	if err != nil {
		fmt.Printf("✗ Error deleting item: %v\n", err)
		return
	}

	if result.Attributes == nil {
		fmt.Println("✗ Item not found")
		return
	}

	var user User
	dynamodbattribute.UnmarshalMap(result.Attributes, &user)
	fmt.Printf("✓ Deleted user: %s\n", user.Name)
}

func scanTable(minAge int) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(tableName),
	}

	if minAge > 0 {
		input.FilterExpression = aws.String("age >= :age")
		input.ExpressionAttributeValues = map[string]*dynamodb.AttributeValue{
			":age": {
				N: aws.String(strconv.Itoa(minAge)),
			},
		}
		fmt.Printf("✓ Scanned items with age >= %d\n", minAge)
	} else {
		fmt.Println("✓ Scanned all items")
	}

	result, err := svc.Scan(input)
	if err != nil {
		fmt.Printf("✗ Error scanning table: %v\n", err)
		return
	}

	var users []User
	err = dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)
	if err != nil {
		fmt.Printf("✗ Error unmarshaling items: %v\n", err)
		return
	}

	fmt.Printf("  Found %d item(s)\n", len(users))
	for _, user := range users {
		fmt.Printf("  - %s: %s (age: %d)\n", user.Name, user.Email, user.Age)
	}
}

func queryByUserID(userID string) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		KeyConditionExpression: aws.String("user_id = :uid"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":uid": {
				S: aws.String(userID),
			},
		},
	}

	result, err := svc.Query(input)
	if err != nil {
		fmt.Printf("✗ Error querying table: %v\n", err)
		return
	}

	var users []User
	err = dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)
	if err != nil {
		fmt.Printf("✗ Error unmarshaling items: %v\n", err)
		return
	}

	fmt.Printf("✓ Found %d item(s) for user_id: %s\n", len(users), userID)
	for _, user := range users {
		fmt.Printf("  - %s (timestamp: %d)\n", user.Name, user.Timestamp)
	}
}

func batchWriteItems() {
	fmt.Println("✓ Batch writing 5 users...")

	users := []User{
		{"user_005", time.Now().Unix(), "Emma Wilson", "emma@example.com", 28, "active"},
		{"user_006", time.Now().Unix(), "Michael Brown", "michael@example.com", 35, "active"},
		{"user_007", time.Now().Unix(), "Sophia Davis", "sophia@example.com", 31, "active"},
		{"user_008", time.Now().Unix(), "James Miller", "james@example.com", 42, "active"},
		{"user_009", time.Now().Unix(), "Olivia Garcia", "olivia@example.com", 26, "active"},
	}

	var writeRequests []*dynamodb.WriteRequest
	for _, user := range users {
		av, err := dynamodbattribute.MarshalMap(user)
		if err != nil {
			fmt.Printf("✗ Error marshaling user: %v\n", err)
			continue
		}

		writeRequests = append(writeRequests, &dynamodb.WriteRequest{
			PutRequest: &dynamodb.PutRequest{
				Item: av,
			},
		})
		fmt.Printf("  - Added %s\n", user.Name)
	}

	input := &dynamodb.BatchWriteItemInput{
		RequestItems: map[string][]*dynamodb.WriteRequest{
			tableName: writeRequests,
		},
	}

	_, err := svc.BatchWriteItem(input)
	if err != nil {
		fmt.Printf("✗ Error batch writing items: %v\n", err)
	}
}
