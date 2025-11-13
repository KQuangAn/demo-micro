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
	"github.com/aws/aws-sdk-go/service/dynamodb/expression"
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
			fmt.Println("3. Data is populated: go run cmd/app/main.go")
		}
	}()

	printSection("Advanced DynamoDB Query Examples")

	// Check if table has data
	result, err := svc.Scan(&dynamodb.ScanInput{
		TableName: aws.String(tableName),
		Limit:     aws.Int64(1),
	})
	if err != nil || len(result.Items) == 0 {
		fmt.Println("\n✗ Table is empty. Run 'go run cmd/app/main.go' first to populate data.")
		return
	}

	// Get current time for range queries
	currentTime := time.Now().Unix()
	startTime := currentTime - 3600 // 1 hour ago

	// 1. Query with sort key condition
	queryWithSortKeyCondition("user_001", startTime, currentTime)

	// 2. Scan with multiple filters
	scanWithFilter(25, "active")

	// 3. Query with projection
	queryWithProjection("user_001")

	// 4. Conditional update
	// Get an item first to get its timestamp
	users := getItemsForUser("user_001")
	if len(users) > 0 {
		conditionalUpdate("user_001", users[0].Timestamp, 31)
	}

	// 5. Paginated scan
	paginatedScan(3)

	// 6. Batch get items
	batchGetItems()

	printSection("Advanced examples complete!")
}

func printSection(title string) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Printf("  %s\n", title)
	fmt.Println(strings.Repeat("=", 60))
}

func queryWithSortKeyCondition(userID string, startTime, endTime int64) {
	fmt.Printf("\n--- Query user '%s' between timestamps %d and %d ---\n", userID, startTime, endTime)

	keyCond := expression.Key("user_id").Equal(expression.Value(userID)).
		And(expression.Key("timestamp").Between(expression.Value(startTime), expression.Value(endTime)))

	expr, err := expression.NewBuilder().WithKeyCondition(keyCond).Build()
	if err != nil {
		fmt.Printf("✗ Error building expression: %v\n", err)
		return
	}

	input := &dynamodb.QueryInput{
		TableName:                 aws.String(tableName),
		KeyConditionExpression:    expr.KeyCondition(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	}

	result, err := svc.Query(input)
	if err != nil {
		fmt.Printf("✗ Error: %v\n", err)
		return
	}

	var users []User
	dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)

	fmt.Printf("✓ Found %d item(s)\n", len(users))
	for _, user := range users {
		fmt.Printf("  - %s: timestamp %d\n", user.Name, user.Timestamp)
	}
}

func scanWithFilter(minAge int, status string) {
	fmt.Printf("\n--- Scan for users with age >= %d and status = '%s' ---\n", minAge, status)

	filt := expression.Name("age").GreaterThanEqual(expression.Value(minAge)).
		And(expression.Name("status").Equal(expression.Value(status)))

	expr, err := expression.NewBuilder().WithFilter(filt).Build()
	if err != nil {
		fmt.Printf("✗ Error building expression: %v\n", err)
		return
	}

	input := &dynamodb.ScanInput{
		TableName:                 aws.String(tableName),
		FilterExpression:          expr.Filter(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	}

	result, err := svc.Scan(input)
	if err != nil {
		fmt.Printf("✗ Error: %v\n", err)
		return
	}

	var users []User
	dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)

	fmt.Printf("✓ Found %d item(s)\n", len(users))
	for _, user := range users {
		fmt.Printf("  - %s: age %d, status %s\n", user.Name, user.Age, user.Status)
	}
}

func queryWithProjection(userID string) {
	fmt.Printf("\n--- Query user '%s' (name and email only) ---\n", userID)

	keyCond := expression.Key("user_id").Equal(expression.Value(userID))
	proj := expression.NamesList(expression.Name("name"), expression.Name("email"))

	expr, err := expression.NewBuilder().
		WithKeyCondition(keyCond).
		WithProjection(proj).
		Build()
	if err != nil {
		fmt.Printf("✗ Error building expression: %v\n", err)
		return
	}

	input := &dynamodb.QueryInput{
		TableName:                 aws.String(tableName),
		KeyConditionExpression:    expr.KeyCondition(),
		ProjectionExpression:      expr.Projection(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	}

	result, err := svc.Query(input)
	if err != nil {
		fmt.Printf("✗ Error: %v\n", err)
		return
	}

	var users []User
	dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)

	fmt.Printf("✓ Found %d item(s)\n", len(users))
	for _, user := range users {
		fmt.Printf("  - Name: %s, Email: %s\n", user.Name, user.Email)
	}
}

func conditionalUpdate(userID string, timestamp int64, newAge int) {
	fmt.Println("\n--- Conditional update: Change age only if status is 'active' ---")

	cond := expression.Name("status").Equal(expression.Value("active"))
	update := expression.Set(expression.Name("age"), expression.Value(newAge))

	expr, err := expression.NewBuilder().
		WithCondition(cond).
		WithUpdate(update).
		Build()
	if err != nil {
		fmt.Printf("✗ Error building expression: %v\n", err)
		return
	}

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
		ConditionExpression:       expr.Condition(),
		UpdateExpression:          expr.Update(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
		ReturnValues:              aws.String("ALL_NEW"),
	}

	_, err = svc.UpdateItem(input)
	if err != nil {
		if strings.Contains(err.Error(), "ConditionalCheckFailedException") {
			fmt.Println("✗ Update failed: Condition not met (status != 'active')")
		} else {
			fmt.Printf("✗ Error: %v\n", err)
		}
		return
	}

	fmt.Printf("✓ Updated age to %d\n", newAge)
}

func paginatedScan(pageSize int64) {
	fmt.Printf("\n--- Paginated scan (page size: %d) ---\n", pageSize)

	pageNum := 1
	var lastEvaluatedKey map[string]*dynamodb.AttributeValue

	for {
		input := &dynamodb.ScanInput{
			TableName: aws.String(tableName),
			Limit:     aws.Int64(pageSize),
		}

		if lastEvaluatedKey != nil {
			input.ExclusiveStartKey = lastEvaluatedKey
		}

		result, err := svc.Scan(input)
		if err != nil {
			fmt.Printf("✗ Error: %v\n", err)
			return
		}

		var users []User
		dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)

		fmt.Printf("\nPage %d: %d item(s)\n", pageNum, len(users))
		for _, user := range users {
			fmt.Printf("  - %s\n", user.Name)
		}

		lastEvaluatedKey = result.LastEvaluatedKey
		if lastEvaluatedKey == nil {
			fmt.Printf("\n✓ Scan complete: %d page(s) total\n", pageNum)
			break
		}

		pageNum++
	}
}

func batchGetItems() {
	fmt.Println("\n--- Batch get items ---")

	// Get some items first
	scanResult, err := svc.Scan(&dynamodb.ScanInput{
		TableName: aws.String(tableName),
		Limit:     aws.Int64(3),
	})
	if err != nil || len(scanResult.Items) == 0 {
		fmt.Println("✗ No items to get")
		return
	}

	// Build keys for batch get (get first 2 items)
	var keys []map[string]*dynamodb.AttributeValue
	for i := 0; i < 2 && i < len(scanResult.Items); i++ {
		item := scanResult.Items[i]
		keys = append(keys, map[string]*dynamodb.AttributeValue{
			"user_id":   item["user_id"],
			"timestamp": item["timestamp"],
		})
	}

	fmt.Printf("Batch get %d items\n", len(keys))

	input := &dynamodb.BatchGetItemInput{
		RequestItems: map[string]*dynamodb.KeysAndAttributes{
			tableName: {
				Keys:                 keys,
				ProjectionExpression: aws.String("#n, email"),
				ExpressionAttributeNames: map[string]*string{
					"#n": aws.String("name"),
				},
			},
		},
	}

	result, err := svc.BatchGetItem(input)
	if err != nil {
		fmt.Printf("✗ Error: %v\n", err)
		return
	}

	items := result.Responses[tableName]
	fmt.Printf("✓ Retrieved %d item(s)\n", len(items))

	var users []User
	dynamodbattribute.UnmarshalListOfMaps(items, &users)

	for _, user := range users {
		fmt.Printf("  - %s: %s\n", user.Name, user.Email)
	}
}

func getItemsForUser(userID string) []User {
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
		return nil
	}

	var users []User
	dynamodbattribute.UnmarshalListOfMaps(result.Items, &users)
	return users
}
