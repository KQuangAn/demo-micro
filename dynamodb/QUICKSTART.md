# Quick Start Guide

## Prerequisites

- Docker Desktop installed and running
- Go 1.21 or higher

## Quick Setup (Automated)

### Windows

```bash
setup.bat
```

### Linux/Mac

```bash
chmod +x setup.sh
./setup.sh
```

The setup script will:

1. Check prerequisites
2. Start LocalStack
3. Download Go dependencies
4. Create the sample DynamoDB table

## Manual Setup

If you prefer to set things up manually:

### 1. Start LocalStack

```bash
docker-compose up -d
```

### 2. Install Go dependencies

```bash
go mod download
```

### 3. Create the table

```bash
go run cmd/create_table/main.go
```

### 4. Run the examples

```bash
go run cmd/app/main.go
```

## What You'll Learn

This project covers:

- ✅ Setting up LocalStack for local DynamoDB development
- ✅ Creating tables with partition and sort keys
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Scanning and querying data
- ✅ Batch operations
- ✅ Conditional updates
- ✅ Filtering and projections
- ✅ Pagination

## Project Files

```
├── docker-compose.yml          # LocalStack configuration
├── go.mod                      # Go dependencies
├── setup.sh / setup.bat       # Automated setup scripts
├── cleanup.sh                 # Reset environment
├── README.md                  # Full documentation
├── QUICKSTART.md             # This file
└── cmd/
    ├── create_table/         # Table creation script
    │   └── main.go
    ├── app/                  # Basic CRUD examples
    │   └── main.go
    └── queries/              # Advanced query patterns
        └── main.go
```

## Common Commands

```bash
# Start LocalStack
docker-compose up -d

# Stop LocalStack
docker-compose down

# View logs
docker-compose logs -f

# Run basic examples
go run cmd/app/main.go

# Run advanced examples
go run cmd/queries/main.go

# Reset everything
./cleanup.sh  # or cleanup.bat on Windows
```

## Testing with AWS CLI

You can also use the AWS CLI to interact with LocalStack:

```bash
# List tables
aws dynamodb list-tables --endpoint-url=http://localhost:4566

# Scan table
aws dynamodb scan --table-name Users --endpoint-url=http://localhost:4566
```

## Troubleshooting

### LocalStack won't start

- Ensure Docker is running
- Check if port 4566 is available
- Try: `docker-compose down` then `docker-compose up -d`

### Connection refused errors

- Wait 5-10 seconds after starting LocalStack
- Check status: `docker ps`

### Table already exists

- Either use the existing table
- Or reset: `./cleanup.sh` then run setup again

## Next Steps

1. ✅ Complete the basic examples (`go run cmd/app/main.go`)
2. ✅ Try advanced queries (`go run cmd/queries/main.go`)
3. 🔨 Modify the code to experiment
4. 📖 Read the full README.md for detailed explanations
5. 🚀 Try building your own DynamoDB application

## Getting Help

- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for Go DynamoDB](https://docs.aws.amazon.com/sdk-for-go/api/service/dynamodb/)

Happy learning! 🎉
