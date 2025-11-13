package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

const (
	localstackEndpoint = "http://localhost:4566"
	region             = "ap-southeast-1"
	tableName          = "BankAccounts"
)

func main() {
	// Create DynamoDB client
	sess := session.Must(session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Endpoint:    aws.String(localstackEndpoint),
		Credentials: credentials.NewStaticCredentials("test", "test", ""),
	}))
	svc := dynamodb.New(sess)

	// Setup
	fmt.Println("=== DynamoDB Transactions Demo ===\n")
	setupTable(svc)
	createAccounts(svc)

	fmt.Println("\n=== Initial State ===")
	showAccounts(svc)

	// // Demo 1: Successful Transfer
	// fmt.Println("\n=== Demo 1: Successful Money Transfer ===")
	// fmt.Println("Transferring $100 from Alice to Bob...")
	// err := transferMoney(svc, "alice", "bob", 100)
	// if err != nil {
	// 	log.Printf("Transfer failed: %v\n", err)
	// } else {
	// 	fmt.Println("✅ Transfer successful!")
	// }
	// showAccounts(svc)

	// // Demo 2: Failed Transfer (Insufficient Funds)
	// fmt.Println("\n=== Demo 2: Failed Transfer (Insufficient Funds) ===")
	// fmt.Println("Trying to transfer $10000 from Bob to Alice...")
	// err = transferMoney(svc, "bob", "alice", 10000)
	// if err != nil {
	// 	fmt.Printf("❌ Transfer failed (expected): %v\n", err)
	// } else {
	// 	fmt.Println("Transfer successful!")
	// }
	// fmt.Println("Checking accounts (should be unchanged):")
	// showAccounts(svc)

	// // Demo 3: Concurrent Transactions
	// fmt.Println("\n=== Demo 3: Concurrent Transactions (No Race Conditions) ===")
	// fmt.Println("Two people trying to withdraw from Charlie's account simultaneously...")
	// concurrentTransfers(svc)
	// showAccounts(svc)

	// // Demo 4: Multi-Operation Transaction
	// fmt.Println("\n=== Demo 4: Multi-Operation Transaction ===")
	// fmt.Println("Creating new account + initial deposit atomically...")
	// err = createAccountWithDeposit(svc, "dave", 500)
	// if err != nil {
	// 	log.Printf("Failed: %v\n", err)
	// } else {
	// 	fmt.Println("✅ Account created with initial deposit!")
	// }
	// showAccounts(svc)

	// // Demo 5: atomic transactions
	// fmt.Println("\n=== Demo 5: Atomic Transactions ===")
	// res, err := atomicTransactionExample(svc, 200)
	// if err != nil {
	// 	log.Printf("Atomic transaction failed: %v\n", err)
	// } else {
	// 	fmt.Printf("Transaction metadata:\n")
	// 	fmt.Printf("  - Consumed Capacity: %+v\n", res.ConsumedCapacity)
	// 	fmt.Printf("  - Item Collection Metrics: %+v\n", res.ItemCollectionMetrics)
	// }

	balance, err := getAccountsBalance(svc, "alice")
	if err != nil {
		log.Printf("Failed to get balance: %v", err)
	} else {
		fmt.Println(balance, "123123")
	}

	fmt.Println("\n=== Demo Complete! ===")
}

func setupTable(svc *dynamodb.DynamoDB) {
	// Delete table if exists
	svc.DeleteTable(&dynamodb.DeleteTableInput{
		TableName: aws.String(tableName),
	})
	time.Sleep(1 * time.Second)

	// Create table
	_, err := svc.CreateTable(&dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []*dynamodb.KeySchemaElement{
			{
				AttributeName: aws.String("account_id"),
				KeyType:       aws.String("HASH"),
			},
			{
				AttributeName: aws.String("record_type"),
				KeyType:       aws.String("RANGE"),
			},
		},
		AttributeDefinitions: []*dynamodb.AttributeDefinition{
			{
				AttributeName: aws.String("account_id"),
				AttributeType: aws.String("S"),
			},
			{
				AttributeName: aws.String("record_type"),
				AttributeType: aws.String("S"),
			},
			{
				AttributeName: aws.String("balance"),
				AttributeType: aws.String("N"),
			},
		},

		// same partition key , different sort key for sorting
		
		LocalSecondaryIndexes: []*dynamodb.LocalSecondaryIndex{
			{
				IndexName: aws.String("BalanceIndex"),
				KeySchema: []*dynamodb.KeySchemaElement{
					{
						AttributeName: aws.String("account_id"),
						KeyType:       aws.String("HASH"),
					},
					{
						AttributeName: aws.String("balance"),
						KeyType:       aws.String("RANGE"),
					},
				},
				Projection: &dynamodb.Projection{
					ProjectionType: aws.String("ALL"),
				},
			},
		},

		// a projection table with different partition key
		// only stores rows in base table that have email key
		GlobalSecondaryIndexes: []*dynamodb.GlobalSecondaryIndex{
			{
				IndexName: aws.String("EmailIndex"),
				KeySchema: []*dynamodb.KeySchemaElement{
					{
						AttributeName: aws.String("email"),
						KeyType:       aws.String("HASH"),
					},
				},
				Projection: &dynamodb.Projection{
					ProjectionType: aws.String("ALL"),
				},
			},
		},

		BillingMode: aws.String("PAY_PER_REQUEST"),
		StreamSpecification: &dynamodb.StreamSpecification{
			StreamEnabled:  aws.Bool(true),
			StreamViewType: aws.String("NEW_AND_OLD_IMAGES"),
		},
	})
	if err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}

	_, err = svc.CreateGlobalTable(&dynamodb.CreateGlobalTableInput{
		GlobalTableName: aws.String(tableName),
		ReplicationGroup: []*dynamodb.Replica{
			{RegionName: aws.String("us-east-1")},
			{RegionName: aws.String("eu-west-1")},
		},
	})

	if err != nil {
		log.Fatalf("Failed to create global table: %v", err)
	}

	fmt.Println("✅ Table created")
}

func createAccounts(svc *dynamodb.DynamoDB) {
	accounts := []struct {
		id      string
		balance int
	}{
		{"alice", 1000},
		{"bob", 500},
		{"charlie", 750},
	}

	for _, acc := range accounts {
		_, err := svc.PutItem(&dynamodb.PutItemInput{
			TableName: aws.String(tableName),
			Item: map[string]*dynamodb.AttributeValue{
				"account_id": {S: aws.String(acc.id)},
				"balance":    {N: aws.String(fmt.Sprintf("%d", acc.balance))},
				"created_at": {S: aws.String(time.Now().Format(time.RFC3339))},
			},
		})
		if err != nil {
			log.Fatalf("Failed to create account: %v", err)
		}
	}
	fmt.Println("✅ Accounts created")
}

// transferMoney demonstrates atomic money transfer using transactions
func transferMoney(svc *dynamodb.DynamoDB, fromAccount, toAccount string, amount int) error {
	// This is the key: Both operations succeed or both fail!
	// Even though they might be on different partitions
	_, err := svc.TransactWriteItems(&dynamodb.TransactWriteItemsInput{
		TransactItems: []*dynamodb.TransactWriteItem{
			// Operation 1: Deduct from source account
			{
				Update: &dynamodb.Update{
					TableName: aws.String(tableName),
					Key: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String(fromAccount)},
					},
					UpdateExpression: aws.String("SET balance = balance - :amount, last_transaction = :time"),
					// CRITICAL: This condition prevents overdraft
					ConditionExpression: aws.String("balance >= :amount"),
					ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
						":amount": {N: aws.String(fmt.Sprintf("%d", amount))},
						":time":   {S: aws.String(time.Now().Format(time.RFC3339))},
					},
				},
			},
			// Operation 2: Add to destination account
			{
				Update: &dynamodb.Update{
					TableName: aws.String(tableName),
					Key: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String(toAccount)},
					},
					UpdateExpression: aws.String("SET balance = balance + :amount, last_transaction = :time"),
					ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
						":amount": {N: aws.String(fmt.Sprintf("%d", amount))},
						":time":   {S: aws.String(time.Now().Format(time.RFC3339))},
					},
				},
			},
		},
	})

	return err
}

// concurrentTransfers demonstrates that DynamoDB prevents race conditions
func concurrentTransfers(svc *dynamodb.DynamoDB) {
	done := make(chan bool, 2)

	// Two goroutines trying to withdraw from same account
	go func() {
		err := transferMoney(svc, "charlie", "alice", 400)
		if err != nil {
			fmt.Println("   Transfer 1: ❌ Failed (expected - one will fail)")
		} else {
			fmt.Println("   Transfer 1: ✅ Success")
		}
		done <- true
	}()

	go func() {
		err := transferMoney(svc, "charlie", "bob", 400)
		if err != nil {
			fmt.Println("   Transfer 2: ❌ Failed (expected - one will fail)")
		} else {
			fmt.Println("   Transfer 2: ✅ Success")
		}
		done <- true
	}()

	<-done
	<-done

	fmt.Println("Result: Only ONE transfer succeeded (no double-spending!)")
}

// createAccountWithDeposit demonstrates multi-operation transaction
func createAccountWithDeposit(svc *dynamodb.DynamoDB, accountId string, initialAmount int) error {
	_, err := svc.TransactWriteItems(&dynamodb.TransactWriteItemsInput{
		TransactItems: []*dynamodb.TransactWriteItem{
			// Operation 1: Create new account
			{
				Put: &dynamodb.Put{
					TableName: aws.String(tableName),
					Item: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String(accountId)},
						"balance":    {N: aws.String(fmt.Sprintf("%d", initialAmount))},
						"created_at": {S: aws.String(time.Now().Format(time.RFC3339))},
					},
					ConditionExpression: aws.String("attribute_not_exists(account_id)"),
				},
			},
			// Operation 2: Deduct from funding account
			{
				Update: &dynamodb.Update{
					TableName: aws.String(tableName),
					Key: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String("alice")},
					},
					UpdateExpression:    aws.String("SET balance = balance - :amount"),
					ConditionExpression: aws.String("balance >= :amount"),
					ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
						":amount": {N: aws.String(fmt.Sprintf("%d", initialAmount))},
					},
				},
			},
		},
	})

	return err
}

func atomicTransactionExample(svc *dynamodb.DynamoDB, value int) (*dynamodb.TransactWriteItemsOutput, error) {
	// Example of an atomic transaction that includes multiple operations
	res, err := svc.TransactWriteItemsWithContext(context.Background(), &dynamodb.TransactWriteItemsInput{ // Fixed: TransactionWriteItemsInput -> TransactWriteItemsInput
		TransactItems: []*dynamodb.TransactWriteItem{
			{
				Update: &dynamodb.Update{
					TableName: aws.String(tableName),
					Key: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String("alice")},
					},
					UpdateExpression:    aws.String("SET balance = balance - :amount"),
					ConditionExpression: aws.String("balance >= :amount"),
					ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
						":amount": {N: aws.String(fmt.Sprintf("%d", value))},
					},
				},
			},
			{
				Update: &dynamodb.Update{
					TableName: aws.String(tableName),
					Key: map[string]*dynamodb.AttributeValue{
						"account_id": {S: aws.String("bob")},
					},
					UpdateExpression: aws.String("SET balance = balance + :amount"),
					ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
						":amount": {N: aws.String(fmt.Sprintf("%d", value))},
					},
				},
			},
		},
	})

	if err != nil {
		log.Printf("Atomic transaction failed: %v", err)
		return nil, err
	}

	return res, nil
}

func showAccounts(svc *dynamodb.DynamoDB) {
	result, err := svc.Scan(&dynamodb.ScanInput{
		TableName: aws.String(tableName),
	})
	if err != nil {
		log.Printf("Failed to scan: %v", err)
		return
	}

	fmt.Println("\nAccount Balances:")
	fmt.Println("─────────────────────────────")
	for _, item := range result.Items {
		accountId := *item["account_id"].S
		balance := *item["balance"].N
		fmt.Printf("%-10s: $%s\n", accountId, balance)
	}
	fmt.Println("─────────────────────────────")
}

func getAccountsBalance(svc *dynamodb.DynamoDB, accountId string) (int, error) {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key: map[string]*dynamodb.AttributeValue{
			"account_id": {S: aws.String(accountId)},
		},
	})

	if err != nil {
		return 0, err
	}

	if result.Item == nil {
		return 0, fmt.Errorf("account not found")
	}

	balance, err := strconv.Atoi(*result.Item["balance"].N)
	if err != nil {
		return 0, err
	}

	return balance, nil
}
