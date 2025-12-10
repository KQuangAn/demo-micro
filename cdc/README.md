# CDC Example with Debezium and Postgres

This project demonstrates a simple Change Data Capture (CDC) setup using Postgres, Debezium (Kafka Connect), and a Go application.

## Prerequisites

- Docker and Docker Compose
- Go 1.21+

## Setup

1.  **Start the infrastructure:**

    ```bash
    docker-compose up -d
    ```

This starts Postgres, Zookeeper, Kafka, and Debezium Connect. Postgres is now configured with `POSTGRES_HOST_AUTH_METHOD=md5`, which creates a host rule that allows connections from your host machine (or any external client) as long as the correct password is supplied.

> **Note:** If you previously started the stack without this setting, stop it with `docker-compose down -v` to remove the old Postgres volume, then bring it up again so the new authentication rule is applied.

2.  **Register the Debezium Connector:**

    Once the services are up (wait a minute for Kafka Connect to start), register the Postgres connector by running the following command:

    ```bash
    curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" localhost:8083/connectors/ -d '{
      "name": "inventory-connector",
      "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "tasks.max": "1",
        "database.hostname": "postgres",
        "database.port": "5432",
        "database.user": "postgres",
        "database.password": "postgres",
        "database.dbname" : "postgres",
        "topic.prefix": "dbserver1",
        "schema.include.list": "public"
      }
    }'
    ```

3.  **Run the Go Application:**

The Go application connects to Postgres, inserts a new user every 5 seconds, **and** starts a goroutine that consumes the `dbserver1.public.users` topic to log CDC messages locally.

```bash
go mod tidy
go run main.go
```

4.  **(Optional) Verify CDC Events Manually:**

If you want to inspect the raw Kafka messages yourself, consume the topic with the Kafka console client.

```bash
# Run a temporary Kafka consumer container
docker-compose exec kafka /usr/bin/kafka-console-consumer --bootstrap-server kafka:9092 --topic dbserver1.public.users --from-beginning
```

You should see JSON messages representing the changes in the `users` table, matching the logs printed by the Go consumer.

## Cleanup

```bash
docker-compose down -v
```

## Troubleshooting

- **`no pg_hba.conf entry` errors**: Ensure the stack was recreated after adding `POSTGRES_HOST_AUTH_METHOD=md5` (see the note in step 1). Running `docker-compose down -v && docker-compose up -d` refreshes the Postgres data directory with the correct host authentication rule.
