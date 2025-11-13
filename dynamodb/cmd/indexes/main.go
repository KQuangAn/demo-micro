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
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

const (
	endpoint  = "http://localhost:4566"
	region    = "us-east-1"
	tableName = "ProductCatalog"
)

// Product represents a product in the catalog
type Product struct {
	ProductID   string  `json:"product_id"` // Partition Key
	Category    string  `json:"category"`   // Sort Key
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	InStock     bool    `json:"in_stock"`
	Rating      float64 `json:"rating"`
	CreatedDate string  `json:"created_date"`
}

var svc *dynamodb.DynamoDB

func init() {
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
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("  DynamoDB Keys and Indexes Demo")
	fmt.Println(strings.Repeat("=", 70))

	// Create table with LSI and GSI
	if err := createTableWithIndexes(); err != nil {
		log.Printf("Error creating table: %v", err)
		return
	}

	// Wait for table to be ready
	fmt.Println("\nWaiting for table to be active...")
	time.Sleep(3 * time.Second)

	// Insert sample data
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("  Inserting Sample Data")
	fmt.Println(strings.Repeat("=", 70))
	insertSampleData()

	// Demonstrate different query patterns
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("  Query Examples")
	fmt.Println(strings.Repeat("=", 70))

	// 1. Query using Primary Key
	fmt.Println("\n1️⃣  PRIMARY KEY QUERY:")
	fmt.Println("   Query: Get all Electronics products")
	queryByPrimaryKey()

	// 2. Query using LSI (sort by rating instead of category)
	fmt.Println("\n2️⃣  LSI QUERY:")
	fmt.Println("   Query: Get products sorted by rating (within same product_id)")
	queryByLSI()

	// 3. Query using GSI (query by category)
	fmt.Println("\n3️⃣  GSI QUERY #1:")
	fmt.Println("   Query: Get all products in 'Electronics' category")
	queryByCategoryGSI()

	// 4. Query using GSI (query by in-stock status and price)
	fmt.Println("\n4️⃣  GSI QUERY #2:")
	fmt.Println("   Query: Get in-stock products with price < 100")
	queryByStockAndPrice()

	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("  Demo Complete!")
	fmt.Println(strings.Repeat("=", 70))
}

func createTableWithIndexes() error {
	// Check if table already exists
	_, err := svc.DescribeTable(&dynamodb.DescribeTableInput{
		TableName: aws.String(tableName),
	})
	if err == nil {
		fmt.Printf("✓ Table '%s' already exists\n", tableName)
		return nil
	}

	fmt.Printf("Creating table '%s' with LSI and GSI...\n", tableName)

	input := &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),

		// Primary Key: product_id (Partition) + category (Sort)
		KeySchema: []*dynamodb.KeySchemaElement{
			{
				AttributeName: aws.String("product_id"),
				KeyType:       aws.String("HASH"), // Partition key
			},
			{
				AttributeName: aws.String("category"),
				KeyType:       aws.String("RANGE"), // Sort key
			},
		},

		// Define attributes (only for keys and index keys)
		AttributeDefinitions: []*dynamodb.AttributeDefinition{
			{AttributeName: aws.String("product_id"), AttributeType: aws.String("S")},
			{AttributeName: aws.String("category"), AttributeType: aws.String("S")},
			{AttributeName: aws.String("rating"), AttributeType: aws.String("N")},
			{AttributeName: aws.String("in_stock"), AttributeType: aws.String("S")},
			{AttributeName: aws.String("price"), AttributeType: aws.String("N")},
		},

		// LSI: Same partition key (product_id), different sort key (rating)
		LocalSecondaryIndexes: []*dynamodb.LocalSecondaryIndex{
			{
				IndexName: aws.String("RatingIndex"),
				KeySchema: []*dynamodb.KeySchemaElement{
					{
						AttributeName: aws.String("product_id"),
						KeyType:       aws.String("HASH"), // Same partition key
					},
					{
						AttributeName: aws.String("rating"),
						KeyType:       aws.String("RANGE"), // Different sort key
					},
				},
				Projection: &dynamodb.Projection{
					ProjectionType: aws.String("ALL"), // Include all attributes
				},
			},
		},

		// GSI: Different partition and sort keys
		GlobalSecondaryIndexes: []*dynamodb.GlobalSecondaryIndex{
			// GSI 1: Query by category
			{
				IndexName: aws.String("CategoryIndex"),
				KeySchema: []*dynamodb.KeySchemaElement{
					{
						AttributeName: aws.String("category"),
						KeyType:       aws.String("HASH"), // Different partition key
					},
					{
						AttributeName: aws.String("price"),
						KeyType:       aws.String("RANGE"), // Can sort by price
					},
				},
				Projection: &dynamodb.Projection{
					ProjectionType: aws.String("ALL"),
				},
			},
			// GSI 2: Query by stock status
			{
				IndexName: aws.String("StockPriceIndex"),
				KeySchema: []*dynamodb.KeySchemaElement{
					{
						AttributeName: aws.String("in_stock"),
						KeyType:       aws.String("HASH"),
					},
					{
						AttributeName: aws.String("price"),
						KeyType:       aws.String("RANGE"),
					},
				},
				Projection: &dynamodb.Projection{
					ProjectionType: aws.String("ALL"),
				},
			},
		},

		BillingMode: aws.String("PAY_PER_REQUEST"),
	}

	_, err = svc.CreateTable(input)
	if err != nil {
		return fmt.Errorf("failed to create table: %v", err)
	}

	fmt.Println("✓ Table created with:")
	fmt.Println("  - Primary Key: product_id + category")
	fmt.Println("  - LSI: product_id + rating")
	fmt.Println("  - GSI 1: category + price")
	fmt.Println("  - GSI 2: in_stock + price")

	return nil
}

func insertSampleData() {
	products := []Product{
		{"PROD-001", "Electronics", "Laptop", 999.99, true, 4.5, "2024-01-01"},
		{"PROD-001", "Accessories", "Mouse", 29.99, true, 4.2, "2024-01-02"},
		{"PROD-002", "Electronics", "Phone", 699.99, true, 4.8, "2024-01-03"},
		{"PROD-002", "Accessories", "Case", 19.99, false, 3.9, "2024-01-04"},
		{"PROD-003", "Electronics", "Tablet", 499.99, true, 4.6, "2024-01-05"},
		{"PROD-004", "Books", "Go Programming", 49.99, true, 4.7, "2024-01-06"},
		{"PROD-005", "Books", "DynamoDB Guide", 39.99, true, 4.9, "2024-01-07"},
		{"PROD-006", "Electronics", "Headphones", 149.99, false, 4.3, "2024-01-08"},
	}

	for _, product := range products {
		av, err := dynamodbattribute.MarshalMap(product)
		if err != nil {
			log.Printf("Error marshaling: %v", err)
			continue
		}

		// Convert boolean to string for GSI
		av["in_stock"] = &dynamodb.AttributeValue{
			S: aws.String(fmt.Sprintf("%t", product.InStock)),
		}

		_, err = svc.PutItem(&dynamodb.PutItemInput{
			TableName: aws.String(tableName),
			Item:      av,
		})
		if err != nil {
			log.Printf("Error putting item: %v", err)
			continue
		}

		fmt.Printf("  ✓ Added: %s - %s ($%.2f)\n", product.Name, product.Category, product.Price)
	}
}

func queryByPrimaryKey() {
	// Query by partition key
	result, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		KeyConditionExpression: aws.String("product_id = :pid"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":pid": {S: aws.String("PROD-001")},
		},
	})

	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	displayResults(result.Items, "Primary Key")
}

func queryByLSI() {
	// Query LSI - sort by rating instead of category
	result, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		IndexName:              aws.String("RatingIndex"),
		KeyConditionExpression: aws.String("product_id = :pid"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":pid": {S: aws.String("PROD-001")},
		},
		ScanIndexForward: aws.Bool(false), // Sort descending (highest rating first)
	})

	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	displayResults(result.Items, "LSI (RatingIndex)")
}

func queryByCategoryGSI() {
	// Query GSI by category
	result, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		IndexName:              aws.String("CategoryIndex"),
		KeyConditionExpression: aws.String("category = :cat"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":cat": {S: aws.String("Electronics")},
		},
	})

	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	displayResults(result.Items, "GSI (CategoryIndex)")
}

func queryByStockAndPrice() {
	// Query GSI by stock status and price range
	result, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String(tableName),
		IndexName:              aws.String("StockPriceIndex"),
		KeyConditionExpression: aws.String("in_stock = :stock AND price < :max_price"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":stock":     {S: aws.String("true")},
			":max_price": {N: aws.String("100")},
		},
	})

	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	displayResults(result.Items, "GSI (StockPriceIndex)")
}

func displayResults(items []map[string]*dynamodb.AttributeValue, queryType string) {
	var products []Product
	err := dynamodbattribute.UnmarshalListOfMaps(items, &products)
	if err != nil {
		log.Printf("Error unmarshaling: %v", err)
		return
	}

	fmt.Printf("   Found %d items using %s:\n", len(products), queryType)
	for i, p := range products {
		inStockStr := "✓"
		if !p.InStock {
			inStockStr = "✗"
		}
		fmt.Printf("   %d. %-20s | %-15s | $%-7.2f | Rating: %.1f | Stock: %s\n",
			i+1, p.Name, p.Category, p.Price, p.Rating, inStockStr)
	}
}
