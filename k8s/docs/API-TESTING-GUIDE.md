# API Testing Guide - cURL Commands for Postman

## 🚀 Quick Setup

### Port Forward Services

Before testing, set up port forwarding:

```bash
# API Gateway (GraphQL)
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro

# Or use NodePort (if available)
# API Gateway: http://localhost:30080
```

---

## 📝 API Gateway (GraphQL) Tests

### Base URL
```
http://localhost:8080/graphql
```

---

## 1️⃣ ORDER SERVICE Tests

### Create Order

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateOrder($input: CreateOrderInput!) { createOrder(input: $input) { id customerId status totalAmount items { id productId quantity price } createdAt } }",
    "variables": {
      "input": {
        "customerId": 1,
        "items": [
          {
            "productId": 1,
            "quantity": 2
          },
          {
            "productId": 2,
            "quantity": 1
          }
        ]
      }
    }
  }'
```

**Postman Setup:**
- Method: `POST`
- URL: `http://localhost:8080/graphql`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "query": "mutation CreateOrder($input: CreateOrderInput!) { createOrder(input: $input) { id customerId status totalAmount items { id productId quantity price } createdAt } }",
  "variables": {
    "input": {
      "customerId": 1,
      "items": [
        {
          "productId": 1,
          "quantity": 2
        },
        {
          "productId": 2,
          "quantity": 1
        }
      ]
    }
  }
}
```

---

### Get Order by ID

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetOrder($id: ID!) { order(id: $id) { id customerId status totalAmount items { id productId quantity price } createdAt updatedAt } }",
    "variables": {
      "id": "1"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "query GetOrder($id: ID!) { order(id: $id) { id customerId status totalAmount items { id productId quantity price } createdAt updatedAt } }",
  "variables": {
    "id": "1"
  }
}
```

---

### Get All Orders

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { orders { id customerId status totalAmount items { id productId quantity price } createdAt } }"
  }'
```

**Postman Body:**
```json
{
  "query": "query { orders { id customerId status totalAmount items { id productId quantity price } createdAt } }"
}
```

---

### Update Order Status

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation UpdateOrderStatus($id: ID!, $status: String!) { updateOrderStatus(id: $id, status: $status) { id status updatedAt } }",
    "variables": {
      "id": "1",
      "status": "CONFIRMED"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation UpdateOrderStatus($id: ID!, $status: String!) { updateOrderStatus(id: $id, status: $status) { id status updatedAt } }",
  "variables": {
    "id": "1",
    "status": "CONFIRMED"
  }
}
```

**Valid Status Values:**
- `PENDING`
- `CONFIRMED`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

---

### Cancel Order

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CancelOrder($id: ID!) { cancelOrder(id: $id) { id status } }",
    "variables": {
      "id": "1"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation CancelOrder($id: ID!) { cancelOrder(id: $id) { id status } }",
  "variables": {
    "id": "1"
  }
}
```

---

## 2️⃣ INVENTORY SERVICE Tests

### Get Product Inventory

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetProduct($id: ID!) { product(id: $id) { id name sku quantity price status createdAt updatedAt } }",
    "variables": {
      "id": "1"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "query GetProduct($id: ID!) { product(id: $id) { id name sku quantity price status createdAt updatedAt } }",
  "variables": {
    "id": "1"
  }
}
```

---

### Get All Products

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { products { id name sku quantity price status } }"
  }'
```

**Postman Body:**
```json
{
  "query": "query { products { id name sku quantity price status } }"
}
```

---

### Create Product

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id name sku quantity price status createdAt } }",
    "variables": {
      "input": {
        "name": "Laptop",
        "sku": "LAP-001",
        "quantity": 50,
        "price": 999.99
      }
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id name sku quantity price status createdAt } }",
  "variables": {
    "input": {
      "name": "Laptop",
      "sku": "LAP-001",
      "quantity": 50,
      "price": 999.99
    }
  }
}
```

---

### Update Product Stock

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation UpdateStock($id: ID!, $quantity: Int!) { updateProductStock(id: $id, quantity: $quantity) { id quantity updatedAt } }",
    "variables": {
      "id": "1",
      "quantity": 100
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation UpdateStock($id: ID!, $quantity: Int!) { updateProductStock(id: $id, quantity: $quantity) { id quantity updatedAt } }",
  "variables": {
    "id": "1",
    "quantity": 100
  }
}
```

---

### Reserve Stock (for Order)

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ReserveStock($productId: ID!, $quantity: Int!, $orderId: ID!) { reserveStock(productId: $productId, quantity: $quantity, orderId: $orderId) { success message } }",
    "variables": {
      "productId": "1",
      "quantity": 5,
      "orderId": "1"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation ReserveStock($productId: ID!, $quantity: Int!, $orderId: ID!) { reserveStock(productId: $productId, quantity: $quantity, orderId: $orderId) { success message } }",
  "variables": {
    "productId": "1",
    "quantity": 5,
    "orderId": "1"
  }
}
```

---

### Check Stock Availability

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query CheckStock($productId: ID!, $quantity: Int!) { checkStockAvailability(productId: $productId, quantity: $quantity) { available currentStock requestedQuantity } }",
    "variables": {
      "productId": "1",
      "quantity": 10
    }
  }'
```

**Postman Body:**
```json
{
  "query": "query CheckStock($productId: ID!, $quantity: Int!) { checkStockAvailability(productId: $productId, quantity: $quantity) { available currentStock requestedQuantity } }",
  "variables": {
    "productId": "1",
    "quantity": 10
  }
}
```

---

## 3️⃣ NOTIFICATION SERVICE Tests

### Send Email Notification

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation SendEmail($input: SendEmailInput!) { sendEmail(input: $input) { id status sentAt } }",
    "variables": {
      "input": {
        "to": "customer@example.com",
        "subject": "Order Confirmation",
        "body": "Your order has been confirmed!",
        "orderId": "1"
      }
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation SendEmail($input: SendEmailInput!) { sendEmail(input: $input) { id status sentAt } }",
  "variables": {
    "input": {
      "to": "customer@example.com",
      "subject": "Order Confirmation",
      "body": "Your order has been confirmed!",
      "orderId": "1"
    }
  }
}
```

---

### Send SMS Notification

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation SendSMS($input: SendSMSInput!) { sendSMS(input: $input) { id status sentAt } }",
    "variables": {
      "input": {
        "phoneNumber": "+1234567890",
        "message": "Your order #123 has been shipped!",
        "orderId": "1"
      }
    }
  }'
```

**Postman Body:**
```json
{
  "query": "mutation SendSMS($input: SendSMSInput!) { sendSMS(input: $input) { id status sentAt } }",
  "variables": {
    "input": {
      "phoneNumber": "+1234567890",
      "message": "Your order #123 has been shipped!",
      "orderId": "1"
    }
  }
}
```

---

### Get Notification History

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetNotifications($orderId: ID!) { notifications(orderId: $orderId) { id type status sentAt recipient subject message } }",
    "variables": {
      "orderId": "1"
    }
  }'
```

**Postman Body:**
```json
{
  "query": "query GetNotifications($orderId: ID!) { notifications(orderId: $orderId) { id type status sentAt recipient subject message } }",
  "variables": {
    "orderId": "1"
  }
}
```

---

## 🔄 Complete End-to-End Test Flow

### Step 1: Create Products

```json
{
  "query": "mutation { createProduct(input: {name: \"Laptop\", sku: \"LAP-001\", quantity: 50, price: 999.99}) { id name sku quantity price } }"
}
```

### Step 2: Check Available Products

```json
{
  "query": "query { products { id name sku quantity price status } }"
}
```

### Step 3: Create Order

```json
{
  "query": "mutation { createOrder(input: {customerId: 1, items: [{productId: 1, quantity: 2}]}) { id customerId status totalAmount items { productId quantity price } } }"
}
```

### Step 4: Check Order Status

```json
{
  "query": "query { order(id: \"1\") { id status totalAmount items { productId quantity price } } }"
}
```

### Step 5: Check Inventory Updated

```json
{
  "query": "query { product(id: \"1\") { id name quantity } }"
}
```

### Step 6: Update Order Status

```json
{
  "query": "mutation { updateOrderStatus(id: \"1\", status: \"CONFIRMED\") { id status } }"
}
```

---

## 🎯 Quick Testing with Postman Collection

### Import These as Postman Collection

1. Open Postman
2. Click **Import**
3. Select **Raw Text**
4. Paste the JSON below

### Postman Collection JSON

```json
{
  "info": {
    "name": "Demo Micro - Microservices API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Orders",
      "item": [
        {
          "name": "Create Order",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"query\": \"mutation { createOrder(input: {customerId: 1, items: [{productId: 1, quantity: 2}]}) { id customerId status totalAmount items { productId quantity price } } }\"\n}"
            },
            "url": {
              "raw": "http://localhost:8080/graphql",
              "protocol": "http",
              "host": ["localhost"],
              "port": "8080",
              "path": ["graphql"]
            }
          }
        },
        {
          "name": "Get All Orders",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"query\": \"query { orders { id customerId status totalAmount createdAt } }\"\n}"
            },
            "url": {
              "raw": "http://localhost:8080/graphql",
              "protocol": "http",
              "host": ["localhost"],
              "port": "8080",
              "path": ["graphql"]
            }
          }
        },
        {
          "name": "Get Order by ID",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"query\": \"query { order(id: \\\"1\\\") { id customerId status totalAmount items { productId quantity price } } }\"\n}"
            },
            "url": {
              "raw": "http://localhost:8080/graphql",
              "protocol": "http",
              "host": ["localhost"],
              "port": "8080",
              "path": ["graphql"]
            }
          }
        }
      ]
    },
    {
      "name": "Inventory",
      "item": [
        {
          "name": "Create Product",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"query\": \"mutation { createProduct(input: {name: \\\"Laptop\\\", sku: \\\"LAP-001\\\", quantity: 50, price: 999.99}) { id name sku quantity price } }\"\n}"
            },
            "url": {
              "raw": "http://localhost:8080/graphql",
              "protocol": "http",
              "host": ["localhost"],
              "port": "8080",
              "path": ["graphql"]
            }
          }
        },
        {
          "name": "Get All Products",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"query\": \"query { products { id name sku quantity price status } }\"\n}"
            },
            "url": {
              "raw": "http://localhost:8080/graphql",
              "protocol": "http",
              "host": ["localhost"],
              "port": "8080",
              "path": ["graphql"]
            }
          }
        }
      ]
    }
  ]
}
```

---

## 🔧 Direct Service Testing (Without API Gateway)

### Order Service Direct (Port 9001)

```bash
# Port forward
kubectl port-forward service/order-service 9001:9001 -n demo-micro

# Health Check
curl http://localhost:9001/health

# GraphQL
curl -X POST http://localhost:9001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ orders { id status } }"}'
```

### Inventory Service Direct (Port 9000)

```bash
# Port forward
kubectl port-forward service/inventory-service 9000:9000 -n demo-micro

# Health Check
curl http://localhost:9000/health

# GraphQL
curl -X POST http://localhost:9000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ products { id name quantity } }"}'
```

### Notification Service Direct (Port 9002)

```bash
# Port forward
kubectl port-forward service/notification-service 9002:9002 -n demo-micro

# Health Check
curl http://localhost:9002/health

# Send notification
curl -X POST http://localhost:9002/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "recipient": "test@example.com",
    "subject": "Test",
    "body": "Test message"
  }'
```

---

## 📊 Expected Responses

### Successful Order Creation
```json
{
  "data": {
    "createOrder": {
      "id": "1",
      "customerId": 1,
      "status": "PENDING",
      "totalAmount": 1999.98,
      "items": [
        {
          "productId": 1,
          "quantity": 2,
          "price": 999.99
        }
      ]
    }
  }
}
```

### GraphQL Error Response
```json
{
  "errors": [
    {
      "message": "Product not found",
      "locations": [{"line": 1, "column": 12}],
      "path": ["createOrder"]
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Connection Refused
```bash
# Check if service is running
kubectl get pods -n demo-micro

# Check service endpoints
kubectl get svc -n demo-micro

# Check port forwarding
lsof -i :8080
```

### GraphQL Schema Errors
```bash
# Check API Gateway logs
kubectl logs -f deployment/api-gateway -n demo-micro
```

### Service Not Responding
```bash
# Check specific service logs
kubectl logs -f deployment/order-service -n demo-micro
kubectl logs -f deployment/inventory-service -n demo-micro
kubectl logs -f deployment/notification-service -n demo-micro
```

---

## 💡 Pro Tips for Postman

1. **Create Environment Variables:**
   - `BASE_URL`: `http://localhost:8080`
   - `ORDER_ID`: `1`
   - `PRODUCT_ID`: `1`

2. **Use Variables in Requests:**
   ```
   {{BASE_URL}}/graphql
   ```

3. **Save Responses:**
   - Use Tests tab to extract IDs from responses
   - Set as environment variables for next requests

4. **Example Test Script:**
   ```javascript
   var response = pm.response.json();
   pm.environment.set("ORDER_ID", response.data.createOrder.id);
   ```

---

## 📚 Additional Resources

- GraphQL Playground: `http://localhost:8080/graphql` (if enabled)
- Kafdrop (Kafka UI): `http://localhost:30900`
- Kibana (Logs): `http://localhost:30561`

---

**Happy Testing! 🚀**

