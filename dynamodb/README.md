# DynamoDB LocalStack with Go

A complete tutorial project demonstrating how to work with Amazon DynamoDB locally using LocalStack and Go. No AWS account or credentials needed!

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Go 1.21 or higher

### Automated Setup (Windows)
```bash
setup.bat
```

### Automated Setup (Linux/Mac)
```bash
chmod +x setup.sh
./setup.sh
```

### Using Make (optional)
```bash
make setup
```

## 📁 Project Structure

```
.
├── docker-compose.yml          # LocalStack configuration
├── go.mod                      # Go module dependencies
├── Makefile                    # Convenient make commands
├── cmd/
│   ├── create_table/          # Table creation script
│   │   └── main.go
│   ├── app/                   # Basic CRUD operations
│   │   └── main.go
│   └── queries/               # Advanced query patterns
│       └── main.go
├── README.md
└── QUICKSTART.md
```

## 🎯 What You'll Learn

### Basic Operations (cmd/app)
- ✅ **Create** items in DynamoDB
- ✅ **Read** items by primary key
- ✅ **Update** items with expressions
- ✅ **Delete** items
- ✅ **Scan** table with filters
- ✅ **Query** by partition key
- ✅ **Batch Write** operations

### Advanced Operations (cmd/queries)
- ✅ Range queries with sort keys
- ✅ Complex filter expressions
- ✅ Projection expressions (select specific attributes)
- ✅ Conditional updates
- ✅ Pagination for large datasets
- ✅ Batch get operations

## 🛠️ Manual Setup

### 1. Start LocalStack
```bash
docker-compose up -d
```

### 2. Install Dependencies
```bash
go mod download
```

### 3. Create Table
```bash
go run cmd/create_table/main.go
```

### 4. Run Examples
```bash
# Basic CRUD operations
go run cmd/app/main.go

# Advanced queries
go run cmd/queries/main.go
```

## 📊 Sample Data Model

**Table Name:** Users

| Attribute | Type | Description |
|-----------|------|-------------|
| user_id | String | Partition key |
| timestamp | Number | Sort key |
| name | String | User's full name |
| email | String | Email address |
| age | Number | User's age |
| status | String | Account status |

## 💻 Code Examples

### Connect to LocalStack
```go
import (
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/dynamodb"
)

sess, _ := session.NewSession(&aws.Config{
    Region:      aws.String("us-east-1"),
    Endpoint:    aws.String("http://localhost:4566"),
    Credentials: credentials.NewStaticCredentials("test", "test", ""),
})

svc := dynamodb.New(sess)
```

### Put Item
```go
user := User{
    UserID:    "user_001",
    Timestamp: time.Now().Unix(),
    Name:      "Alice Johnson",
    Email:     "alice@example.com",
    Age:       30,
    Status:    "active",
}

av, _ := dynamodbattribute.MarshalMap(user)
svc.PutItem(&dynamodb.PutItemInput{
    TableName: aws.String("Users"),
    Item:      av,
})
```

### Query Items
```go
result, _ := svc.Query(&dynamodb.QueryInput{
    TableName:              aws.String("Users"),
    KeyConditionExpression: aws.String("user_id = :uid"),
    ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
        ":uid": {S: aws.String("user_001")},
    },
})
```

## 🔧 Useful Commands

### Using Make
```bash
make start          # Start LocalStack
make stop           # Stop LocalStack
make logs           # View logs
make clean          # Reset everything
make run-app        # Run basic examples
make run-queries    # Run advanced examples
make test           # Run all examples
```

### Using Docker Compose
```bash
docker-compose up -d        # Start
docker-compose down         # Stop
docker-compose logs -f      # View logs
docker-compose down -v      # Stop and remove volumes
```

### Using AWS CLI
```bash
# List tables
aws dynamodb list-tables --endpoint-url=http://localhost:4566

# Describe table
aws dynamodb describe-table --table-name Users --endpoint-url=http://localhost:4566

# Scan table
aws dynamodb scan --table-name Users --endpoint-url=http://localhost:4566
```

## 🐛 Troubleshooting

### LocalStack not starting
- Ensure Docker is running: `docker ps`
- Check port 4566 is available
- Try: `docker-compose down && docker-compose up -d`

### Connection refused
- Wait 5-10 seconds after starting LocalStack
- Verify LocalStack is healthy: `curl http://localhost:4566/_localstack/health`

### Table already exists
- Tables persist between runs
- Either use existing table or run: `make clean && make setup`

### Go dependency issues
- Run: `go mod tidy`
- Clear cache: `go clean -modcache`
- Re-download: `go mod download`

## 📚 Learning Resources

- [DynamoDB Core Components](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for Go - DynamoDB](https://docs.aws.amazon.com/sdk-for-go/api/service/dynamodb/)
- [DynamoDB Expression Package](https://docs.aws.amazon.com/sdk-for-go/api/service/dynamodb/expression/)

## 🎓 Next Steps

1. ✅ Run basic examples to understand CRUD operations
2. ✅ Explore advanced queries for complex use cases
3. 🔨 Modify the code - try different data models
4. 📖 Read about DynamoDB design patterns
5. 🚀 Build your own application
6. 🧪 Experiment with:
   - Global Secondary Indexes (GSI)
   - Local Secondary Indexes (LSI)
   - DynamoDB Streams
   - Transactions
   - Time To Live (TTL)

## 💡 DynamoDB Tips

- **Schema Design**: DynamoDB is schema-less except for primary keys
- **Partition Keys**: Choose carefully for even data distribution
- **Sort Keys**: Enable range queries and hierarchical data
- **Access Patterns**: Design your table structure based on how you'll query the data
- **Hot Partitions**: Avoid concentrating reads/writes on single partition
- **Consistency**: Choose between eventual and strong consistency based on needs
- **Capacity**: Use on-demand or provisioned billing mode appropriately

## 📝 License

This project is for educational purposes. Feel free to use and modify as needed.

---

**Happy Learning!** 🚀

If you find this helpful, consider starring the repository and sharing with others learning DynamoDB!
